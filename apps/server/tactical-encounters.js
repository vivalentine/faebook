const db = require("./db");
const { createAuditLog } = require("./archive");
const { buildFinaleFixture } = require("./tactical-finale-fixture");

const SCHEMA_VERSION = 2;
const LIMITS = { tokens: 250, zones: 100, crowdRegions: 50, tethers: 300, spotlights: 100, tokenFamilies: 100, annotations: 100, aoes: 50, initiative: 100, eventLog: 1000, phases: 50, events: 250 };
const STATUSES = new Set(["prep", "active", "complete"]);
const TOKEN_CATEGORIES = new Set(["player", "ally", "enemy", "boss", "object"]);
const ZONE_KINDS = new Set(["hazard", "terrain", "effect", "objective", "custom"]);
const CROWD_STATES = new Set(["idle", "agitated", "surging", "hostile", "destroyed"]);

function defaultState() {
  return {
    battlefield: { width: 2400, height: 1600, backgroundImageUrl: "", imageScale: 1, imageX: 0, imageY: 0, gridVisible: true, snapEnabled: true, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, distancePerSquare: 5, unit: "ft" },
    schemaVersion: SCHEMA_VERSION,
    tokens: [], initiative: { round: 1, currentIndex: 0, manualOrder: false, entries: [] },
    phases: [], activePhaseId: null, zones: [], crowdRegions: [], tethers: [], spotlights: [], spotlightQueue: [], spotlightPreset: { radius: 150, tracking: true, durationRounds: 1, effectNotes: "" }, tokenFamilies: [], annotations: [], aoes: [], events: [], eventLog: [],
  };
}

function finite(value, min, max) { return Number.isFinite(value) && value >= min && value <= max; }
function text(value, max, required = false) { return typeof value === "string" && value.length <= max && (!required || value.trim().length > 0); }
function point(value) { return value && finite(value.x, -100000, 100000) && finite(value.y, -100000, 100000); }
function uniqueIds(items) { return items.every((item, index) => text(item?.id, 100, true) && items.findIndex((other) => other.id === item.id) === index); }

function validateState(input) {
  const issues = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return ["state must be an object"];
  const arrays = ["tokens", "phases", "zones", "crowdRegions", "tethers", "spotlights", "spotlightQueue", "tokenFamilies", "annotations", "aoes", "events", "eventLog"];
  arrays.forEach((key) => { if (!Array.isArray(input[key])) issues.push(`${key} must be an array`); });
  if (issues.length) return issues;
  Object.entries(LIMITS).forEach(([key, max]) => {
    const items = key === "initiative" ? input.initiative?.entries : input[key];
    if (!Array.isArray(items) || items.length > max) issues.push(`${key} exceeds limit ${max}`);
  });
  if (!input.battlefield || !finite(input.battlefield.width, 100, 20000) || !finite(input.battlefield.height, 100, 20000) || !finite(input.battlefield.gridSize, 5, 1000) || !finite(input.battlefield.distancePerSquare, 0.01, 100000) || !text(input.battlefield.unit, 12, true)) issues.push("invalid battlefield settings");
  if (!input.initiative || !Number.isInteger(input.initiative.round) || input.initiative.round < 1 || !Number.isInteger(input.initiative.currentIndex)) issues.push("invalid initiative state");
  if (!uniqueIds(input.tokens)) issues.push("token IDs must be unique");
  input.tokens.forEach((token) => {
    if (!text(token.name, 120, true) || !point(token) || !finite(token.size, 10, 1000) || !TOKEN_CATEGORIES.has(token.category) || !Array.isArray(token.conditions) || token.conditions.length > 30 || token.conditions.some((c) => !text(c, 60, true))) issues.push(`invalid token ${token.id || "(unknown)"}`);
    ["currentHp", "maxHp", "tempHp", "ac"].forEach((key) => { if (token[key] != null && !finite(token[key], 0, 1000000)) issues.push(`invalid token ${key}`); });
  });
  if (!uniqueIds(input.zones) || input.zones.some((zone) => !text(zone.name, 120, true) || !ZONE_KINDS.has(zone.kind) || !Array.isArray(zone.points) || zone.points.length < 3 || zone.points.length > 100 || !zone.points.every(point))) issues.push("invalid zone data");
  if (!uniqueIds(input.crowdRegions) || input.crowdRegions.some((region) => !text(region.name, 120, true) || !CROWD_STATES.has(region.state) || !Array.isArray(region.points) || region.points.length < 3 || region.points.length > 100 || !region.points.every(point))) issues.push("invalid crowd region data");
  if (!uniqueIds(input.tethers) || input.tethers.some((item) => !text(item.name, 120, true) || !["puppet","binding","anchor","ritual","custom"].includes(item.category) || !item.source || !item.target)) issues.push("invalid tether data");
  if (!uniqueIds(input.spotlights) || input.spotlights.some((item) => !text(item.name, 120, true) || !finite(item.radius, 1, 10000) || !item.target)) issues.push("invalid spotlight data");
  if (!uniqueIds(input.tokenFamilies) || input.tokenFamilies.some((item) => !text(item.name, 120, true) || !Array.isArray(item.tokenIds))) issues.push("invalid token family data");
  if (!Array.isArray(input.initiative?.entries) || !uniqueIds(input.initiative?.entries || []) || input.initiative.entries.some((entry) => !text(entry.name, 120, true) || !finite(entry.initiative, -1000, 1000))) issues.push("invalid initiative entries");
  [input.phases, input.annotations, input.events, input.eventLog].forEach((items) => { if (!uniqueIds(items)) issues.push("object IDs must be unique"); });
  return [...new Set(issues)];
}

function normalizeState(raw, version = 1) {
  if (![1, SCHEMA_VERSION].includes(version)) throw new Error("Unsupported encounter schema version");
  const base = defaultState();
  const state = { ...base, ...raw, battlefield: { ...base.battlefield, ...(raw?.battlefield || {}) }, initiative: { ...base.initiative, ...(raw?.initiative || {}) } };
  state.schemaVersion = SCHEMA_VERSION;
  state.tokens = state.tokens.map((token) => ({ damageState: "normal", defeated: false, ...token }));
  state.initiative.entries = state.initiative.entries.map((entry) => ({ ...entry, tokenIds: entry.tokenIds || (entry.tokenId ? [entry.tokenId] : []) }));
  state.phases = state.phases.map((phase) => { const recipe=phase.recipe || { showTokenIds: phase.activeTokenIds || [], activateZoneIds: phase.activeZoneIds || [], activateCrowdRegionIds: phase.activeCrowdRegionIds || [] }; const familyIds=new Set(state.tokenFamilies.map(item=>item.id)); recipe.showFamilyIds=(recipe.showFamilyIds||[]).filter(id=>familyIds.has(id)); recipe.hideFamilyIds=(recipe.hideFamilyIds||[]).filter(id=>familyIds.has(id)); recipe.familyMutations=(recipe.familyMutations||[]).filter(item=>familyIds.has(item.familyId)); return { ...phase, recipe }; });
  state.eventLog = state.eventLog.slice(-LIMITS.eventLog);
  return state;
}
function parseId(value) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; }
function serialize(row, includeState = true) {
  const state = normalizeState(JSON.parse(row.state_json), row.schema_version);
  const phase = state.phases.find((item) => item.id === state.activePhaseId);
  return { id: row.id, name: row.name, status: row.status, schemaVersion: row.schema_version, ...(includeState ? { state } : { mapName: state.battlefield.mapName || null, currentPhase: phase?.name || null, currentRound: state.initiative.round, tokenCount: state.tokens.length }), createdAt: row.created_at, updatedAt: row.updated_at, archivedAt: row.archived_at };
}
function audit(userId, action, id, message) { createAuditLog(db, { actorUserId: userId, actionType: action, objectType: "tactical_encounter", objectId: id, message }); }

function registerTacticalEncounterRoutes(app, requireDm) {
  app.get("/api/dm/encounters", requireDm, (req, res) => {
    const archived = req.query.archived === "true";
    const rows = db.prepare(`SELECT * FROM tactical_encounters WHERE archived_at IS ${archived ? "NOT NULL" : "NULL"} ORDER BY updated_at DESC`).all();
    res.json({ encounters: rows.map((row) => serialize(row, false)) });
  });
  app.post("/api/dm/encounters", requireDm, (req, res) => {
    const name = String(req.body?.name || "New Tactical Encounter").trim();
    const status = req.body?.status || "prep";
    let state;
    try { state = normalizeState(req.body?.state || defaultState(), 1); } catch (error) { return res.status(400).json({ error: error.message }); }
    const issues = [...(!text(name, 120, true) ? ["invalid name"] : []), ...(!STATUSES.has(status) ? ["invalid status"] : []), ...validateState(state)];
    if (issues.length) return res.status(400).json({ error: "Invalid encounter", issues });
    const now = new Date().toISOString();
    const result = db.prepare("INSERT INTO tactical_encounters (name,status,schema_version,state_json,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(name, status, SCHEMA_VERSION, JSON.stringify(state), req.session.user.id, now, now);
    audit(req.session.user.id, "create", result.lastInsertRowid, `Created tactical encounter ${name}`);
    res.status(201).json({ encounter: serialize(db.prepare("SELECT * FROM tactical_encounters WHERE id = ?").get(result.lastInsertRowid)) });
  });
  app.post("/api/dm/encounters/fixtures/finale",requireDm,(req,res)=>{const state=buildFinaleFixture(defaultState),issues=validateState(state);if(issues.length)return res.status(500).json({error:"Fixture validation failed",issues});const now=new Date().toISOString(),result=db.prepare("INSERT INTO tactical_encounters (name,status,schema_version,state_json,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("Idol Willow Finale Stress Test","prep",SCHEMA_VERSION,JSON.stringify(state),req.session.user.id,now,now);audit(req.session.user.id,"create_fixture",result.lastInsertRowid,"Created Idol Willow finale stress fixture");res.status(201).json({encounter:serialize(db.prepare("SELECT * FROM tactical_encounters WHERE id=?").get(result.lastInsertRowid))});});
  app.get("/api/dm/encounters/:id", requireDm, (req, res) => {
    const id = parseId(req.params.id); if (!id) return res.status(400).json({ error: "Invalid encounter ID" });
    const row = db.prepare("SELECT * FROM tactical_encounters WHERE id = ? AND archived_at IS NULL").get(id);
    if (!row) return res.status(404).json({ error: "Encounter not found" });
    try { return res.json({ encounter: serialize(row) }); } catch { return res.status(500).json({ error: "Encounter state could not be loaded" }); }
  });
  app.patch("/api/dm/encounters/:id", requireDm, (req, res) => {
    const id = parseId(req.params.id); if (!id) return res.status(400).json({ error: "Invalid encounter ID" });
    const row = db.prepare("SELECT * FROM tactical_encounters WHERE id = ? AND archived_at IS NULL").get(id); if (!row) return res.status(404).json({ error: "Encounter not found" });
    const name = req.body.name === undefined ? row.name : String(req.body.name).trim(); const status = req.body.status ?? row.status;
    let state; try { state = req.body.state === undefined ? normalizeState(JSON.parse(row.state_json), row.schema_version) : normalizeState(req.body.state, req.body.schemaVersion ?? 1); } catch (error) { return res.status(400).json({ error: error.message }); }
    const issues = [...(!text(name, 120, true) ? ["invalid name"] : []), ...(!STATUSES.has(status) ? ["invalid status"] : []), ...validateState(state)]; if (issues.length) return res.status(400).json({ error: "Invalid encounter", issues });
    const now = new Date().toISOString(); db.prepare("UPDATE tactical_encounters SET name=?,status=?,schema_version=?,state_json=?,updated_at=? WHERE id=?").run(name,status,SCHEMA_VERSION,JSON.stringify(state),now,id);
    res.json({ encounter: serialize(db.prepare("SELECT * FROM tactical_encounters WHERE id=?").get(id)) });
  });
  app.post("/api/dm/encounters/:id/duplicate", requireDm, (req, res) => {
    const id = parseId(req.params.id); const row = id && db.prepare("SELECT * FROM tactical_encounters WHERE id=? AND archived_at IS NULL").get(id); if (!row) return res.status(404).json({ error: "Encounter not found" });
    req.body = { name: `${row.name} (Copy)`, status: "prep", state: normalizeState(JSON.parse(row.state_json), row.schema_version) };
    const now = new Date().toISOString(); const result = db.prepare("INSERT INTO tactical_encounters (name,status,schema_version,state_json,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(req.body.name,"prep",SCHEMA_VERSION,JSON.stringify(req.body.state),req.session.user.id,now,now);
    audit(req.session.user.id,"duplicate",result.lastInsertRowid,`Duplicated tactical encounter ${row.name}`); res.status(201).json({ encounter: serialize(db.prepare("SELECT * FROM tactical_encounters WHERE id=?").get(result.lastInsertRowid)) });
  });
  app.delete("/api/dm/encounters/:id", requireDm, (req, res) => { const id=parseId(req.params.id); const row=id&&db.prepare("SELECT name FROM tactical_encounters WHERE id=? AND archived_at IS NULL").get(id); if(!row)return res.status(404).json({error:"Encounter not found"}); const now=new Date().toISOString(); db.prepare("UPDATE tactical_encounters SET archived_at=?,archived_by_user_id=?,updated_at=? WHERE id=?").run(now,req.session.user.id,now,id); audit(req.session.user.id,"archive",id,`Archived tactical encounter ${row.name}`); res.status(204).end(); });
  app.get("/api/dm/encounters/:id/snapshots", requireDm, (req,res)=>{const id=parseId(req.params.id);if(!id)return res.status(400).json({error:"Invalid encounter ID"});const snapshots=db.prepare("SELECT * FROM tactical_encounter_snapshots WHERE encounter_id=? ORDER BY created_at DESC").all(id).map(row=>{const state=normalizeState(JSON.parse(row.state_json),row.schema_version),phase=state.phases.find(x=>x.id===state.activePhaseId);return{id:row.id,name:row.name,createdAt:row.created_at,round:state.initiative.round,phase:phase?.name||null}});res.json({snapshots});});
  app.post("/api/dm/encounters/:id/snapshots", requireDm, (req,res)=>{const id=parseId(req.params.id);const row=id&&db.prepare("SELECT * FROM tactical_encounters WHERE id=? AND archived_at IS NULL").get(id);if(!row)return res.status(404).json({error:"Encounter not found"});const name=String(req.body?.name||`Snapshot ${new Date().toLocaleString()}`).trim().slice(0,120);const now=new Date().toISOString();const result=db.prepare("INSERT INTO tactical_encounter_snapshots (encounter_id,name,schema_version,state_json,created_by_user_id,created_at) VALUES (?,?,?,?,?,?)").run(id,name,SCHEMA_VERSION,row.state_json,req.session.user.id,now);res.status(201).json({snapshot:{id:result.lastInsertRowid,name,createdAt:now}});});
  app.post("/api/dm/encounters/:id/snapshots/:snapshotId/restore", requireDm, (req,res)=>{const id=parseId(req.params.id),sid=parseId(req.params.snapshotId);const snap=id&&sid&&db.prepare("SELECT * FROM tactical_encounter_snapshots WHERE id=? AND encounter_id=?").get(sid,id);if(!snap)return res.status(404).json({error:"Snapshot not found"});const state=normalizeState(JSON.parse(snap.state_json),snap.schema_version);const issues=validateState(state);if(issues.length)return res.status(422).json({error:"Snapshot is invalid",issues});const now=new Date().toISOString(),current=db.prepare("SELECT * FROM tactical_encounters WHERE id=? AND archived_at IS NULL").get(id);if(current)db.prepare("INSERT INTO tactical_encounter_snapshots (encounter_id,name,schema_version,state_json,created_by_user_id,created_at) VALUES (?,?,?,?,?,?)").run(id,"[Recovery] Before snapshot restore",SCHEMA_VERSION,current.state_json,req.session.user.id,now);db.prepare("UPDATE tactical_encounters SET schema_version=?,state_json=?,updated_at=? WHERE id=? AND archived_at IS NULL").run(SCHEMA_VERSION,JSON.stringify(state),now,id);audit(req.session.user.id,"snapshot_restore",id,`Restored snapshot ${snap.name}`);res.json({encounter:serialize(db.prepare("SELECT * FROM tactical_encounters WHERE id=?").get(id))});});
  app.patch("/api/dm/encounters/:id/snapshots/:snapshotId",requireDm,(req,res)=>{const id=parseId(req.params.id),sid=parseId(req.params.snapshotId),name=String(req.body?.name||"").trim();if(!id||!sid||!text(name,120,true))return res.status(400).json({error:"Invalid snapshot"});const result=db.prepare("UPDATE tactical_encounter_snapshots SET name=? WHERE id=? AND encounter_id=?").run(name,sid,id);if(!result.changes)return res.status(404).json({error:"Snapshot not found"});res.json({snapshot:{id:sid,name}});});
  app.delete("/api/dm/encounters/:id/snapshots/:snapshotId",requireDm,(req,res)=>{const result=db.prepare("DELETE FROM tactical_encounter_snapshots WHERE id=? AND encounter_id=?").run(parseId(req.params.snapshotId),parseId(req.params.id));if(!result.changes)return res.status(404).json({error:"Snapshot not found"});res.status(204).end();});
  app.post("/api/dm/encounters/:id/snapshots/:snapshotId/duplicate",requireDm,(req,res)=>{const id=parseId(req.params.id),sid=parseId(req.params.snapshotId),snap=id&&sid&&db.prepare("SELECT * FROM tactical_encounter_snapshots WHERE id=? AND encounter_id=?").get(sid,id);if(!snap)return res.status(404).json({error:"Snapshot not found"});const now=new Date().toISOString(),result=db.prepare("INSERT INTO tactical_encounters (name,status,schema_version,state_json,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(`${snap.name} (Snapshot)`,`prep`,SCHEMA_VERSION,snap.state_json,req.session.user.id,now,now);res.status(201).json({encounter:serialize(db.prepare("SELECT * FROM tactical_encounters WHERE id=?").get(result.lastInsertRowid))});});
  app.get("/api/dm/encounters/:id/recoveries",requireDm,(req,res)=>{const id=parseId(req.params.id);if(!id)return res.status(400).json({error:"Invalid encounter ID"});const recoveries=db.prepare("SELECT * FROM tactical_encounter_snapshots WHERE encounter_id=? AND name LIKE '[Recovery] %' ORDER BY created_at DESC LIMIT 10").all(id).map(row=>{const state=normalizeState(JSON.parse(row.state_json),row.schema_version),phase=state.phases.find(x=>x.id===state.activePhaseId);return{id:row.id,reason:row.name.slice(11),createdAt:row.created_at,round:state.initiative.round,phase:phase?.name||null}});res.json({recoveries});});
  app.post("/api/dm/encounters/:id/recoveries",requireDm,(req,res)=>{const id=parseId(req.params.id),row=id&&db.prepare("SELECT * FROM tactical_encounters WHERE id=? AND archived_at IS NULL").get(id);if(!row)return res.status(404).json({error:"Encounter not found"});const reason=String(req.body?.reason||"Automatic recovery").trim().slice(0,90),now=new Date().toISOString();const latest=db.prepare("SELECT state_json FROM tactical_encounter_snapshots WHERE encounter_id=? AND name LIKE '[Recovery] %' ORDER BY created_at DESC LIMIT 1").get(id);if(latest?.state_json===row.state_json)return res.status(204).end();const result=db.prepare("INSERT INTO tactical_encounter_snapshots (encounter_id,name,schema_version,state_json,created_by_user_id,created_at) VALUES (?,?,?,?,?,?)").run(id,`[Recovery] ${reason}`,SCHEMA_VERSION,row.state_json,req.session.user.id,now);db.prepare("DELETE FROM tactical_encounter_snapshots WHERE encounter_id=? AND name LIKE '[Recovery] %' AND id NOT IN (SELECT id FROM tactical_encounter_snapshots WHERE encounter_id=? AND name LIKE '[Recovery] %' ORDER BY created_at DESC LIMIT 10)").run(id,id);res.status(201).json({recovery:{id:result.lastInsertRowid,reason,createdAt:now}});});
  app.post("/api/dm/encounters/:id/recoveries/:recoveryId/restore",requireDm,(req,res)=>{const id=parseId(req.params.id),rid=parseId(req.params.recoveryId),current=id&&db.prepare("SELECT * FROM tactical_encounters WHERE id=? AND archived_at IS NULL").get(id),recovery=id&&rid&&db.prepare("SELECT * FROM tactical_encounter_snapshots WHERE id=? AND encounter_id=? AND name LIKE '[Recovery] %'").get(rid,id);if(!current||!recovery)return res.status(404).json({error:"Recovery not found"});const now=new Date().toISOString();db.prepare("INSERT INTO tactical_encounter_snapshots (encounter_id,name,schema_version,state_json,created_by_user_id,created_at) VALUES (?,?,?,?,?,?)").run(id,"[Recovery] Before recovery restore",SCHEMA_VERSION,current.state_json,req.session.user.id,now);const state=normalizeState(JSON.parse(recovery.state_json),recovery.schema_version);state.eventLog.push({id:`recovery-${Date.now()}`,label:`Restored recovery: ${recovery.name.slice(11)}`,at:now});db.prepare("UPDATE tactical_encounters SET schema_version=?,state_json=?,updated_at=? WHERE id=?").run(SCHEMA_VERSION,JSON.stringify(state),now,id);audit(req.session.user.id,"recovery_restore",id,`Restored tactical recovery ${recovery.name.slice(11)}`);res.json({encounter:serialize(db.prepare("SELECT * FROM tactical_encounters WHERE id=?").get(id))});});
  app.post("/api/dm/encounters/import",requireDm,(req,res)=>{const payload=req.body?.format==="faebook-tactical-encounter"?req.body:null;if(!payload)return res.status(400).json({error:"Invalid encounter export"});let state;try{state=normalizeState(payload.state,payload.schemaVersion||1)}catch(error){return res.status(400).json({error:error.message})}const issues=validateState(state);if(issues.length)return res.status(422).json({error:"Invalid encounter export",issues});const name=String(payload.name||"Imported Tactical Encounter").trim().slice(0,120),now=new Date().toISOString();const result=db.prepare("INSERT INTO tactical_encounters (name,status,schema_version,state_json,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(`${name} (Imported)`,"prep",SCHEMA_VERSION,JSON.stringify(state),req.session.user.id,now,now);audit(req.session.user.id,"import",result.lastInsertRowid,`Imported tactical encounter ${name}`);res.status(201).json({encounter:serialize(db.prepare("SELECT * FROM tactical_encounters WHERE id=?").get(result.lastInsertRowid))});});
}

module.exports = { SCHEMA_VERSION, defaultState, normalizeState, registerTacticalEncounterRoutes, validateState };
