const db = require("./db");
const { createAuditLog } = require("./archive");
const { storeTacticalImage } = require("./tactical-assets");

const LIMITS = { tokens: 250, zones: 100, crowdRegions: 50, tethers: 250, spotlights: 50, aoes: 100, annotations: 100, initiative: 100, eventLog: 1000, phases: 50, families: 100, events: 250 };
const STATUSES = new Set(["prep", "active", "complete"]);
const TOKEN_CATEGORIES = new Set(["player", "ally", "enemy", "boss", "object"]);
const ZONE_KINDS = new Set(["hazard", "terrain", "effect", "objective", "custom"]);
const CROWD_STATES = new Set(["idle", "agitated", "surging", "hostile", "destroyed"]);

function defaultState() {
  return {
    battlefield: { width: 2400, height: 1600, backgroundImageUrl: "", imageScale: 1, imageX: 0, imageY: 0, mapLocked: true, gridVisible: true, snapEnabled: true, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, distancePerSquare: 5, unit: "ft", presentationCamera: { zoom: .75, panX: 40, panY: 40 }, anaglyph: { separation: 6, opacity: .45, strokeWidth: 2, red: "#ff1744", cyan: "#00e5ff" } },
    presentation: { frozen: false, blackout: false, layers: { background: true, grid: true, tokens: true, tokenLabels: "full", hpBars: false, conditions: false, defeatedTokens: true, zones: true, crowdRegions: true, strings: true, spotlights: true, aoes: true, annotations: true } },
    tokens: [], initiative: { round: 1, currentIndex: 0, manualOrder: false, entries: [] },
    phases: [], activePhaseId: null, families: [], zones: [], crowdRegions: [], tethers: [], spotlights: [], aoes: [], annotations: [], events: [], eventLog: [],
  };
}

function finite(value, min, max) { return Number.isFinite(value) && value >= min && value <= max; }
function text(value, max, required = false) { return typeof value === "string" && value.length <= max && (!required || value.trim().length > 0); }
function point(value) { return value && finite(value.x, -100000, 100000) && finite(value.y, -100000, 100000); }
function uniqueIds(items) { return items.every((item, index) => text(item?.id, 100, true) && items.findIndex((other) => other.id === item.id) === index); }

function validateState(input) {
  const issues = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return ["state must be an object"];
  const arrays = ["tokens", "phases", "families", "zones", "crowdRegions", "tethers", "spotlights", "aoes", "annotations", "events", "eventLog"];
  arrays.forEach((key) => { if (!Array.isArray(input[key])) issues.push(`${key} must be an array`); });
  if (issues.length) return issues;
  Object.entries(LIMITS).forEach(([key, max]) => {
    const items = key === "initiative" ? input.initiative?.entries : input[key];
    if (!Array.isArray(items) || items.length > max) issues.push(`${key} exceeds limit ${max}`);
  });
  if (!input.battlefield || !finite(input.battlefield.width, 100, 20000) || !finite(input.battlefield.height, 100, 20000) || !finite(input.battlefield.gridSize, 5, 1000) || !finite(input.battlefield.distancePerSquare, 0.01, 100000) || !text(input.battlefield.unit, 12, true)) issues.push("invalid battlefield settings");
  const measurement = input.presentation?.measurement;
  if (measurement != null && (!point(measurement.start) || !point(measurement.end) || !finite(measurement.distance, 0, 1000000) || !finite(measurement.horizontal, 0, 1000000) || !finite(measurement.vertical, 0, 200000) || !["2d","3d"].includes(measurement.mode) || !text(measurement.unit, 12, true))) issues.push("invalid presentation measurement");
  if (!input.initiative || !Number.isInteger(input.initiative.round) || input.initiative.round < 1 || !Number.isInteger(input.initiative.currentIndex)) issues.push("invalid initiative state");
  if (!uniqueIds(input.tokens)) issues.push("token IDs must be unique");
  input.tokens.forEach((token) => {
    if (!text(token.name, 120, true) || !point(token) || !finite(token.size, 10, 1000) || !TOKEN_CATEGORIES.has(token.category) || !Array.isArray(token.conditions) || token.conditions.length > 30 || token.conditions.some((c) => !text(c, 60, true))) issues.push(`invalid token ${token.id || "(unknown)"}`);
    if (token.altitude != null && !finite(token.altitude, -100000, 100000)) issues.push(`invalid token altitude ${token.id || "(unknown)"}`);
    ["currentHp", "maxHp", "tempHp", "ac"].forEach((key) => { if (token[key] != null && !finite(token[key], 0, 1000000)) issues.push(`invalid token ${key}`); });
  });
  if (!uniqueIds(input.zones) || input.zones.some((zone) => !text(zone.name, 120, true) || !ZONE_KINDS.has(zone.kind) || !Array.isArray(zone.points) || zone.points.length < 3 || zone.points.length > 100 || !zone.points.every(point))) issues.push("invalid zone data");
  if (!uniqueIds(input.crowdRegions) || input.crowdRegions.some((region) => !text(region.name, 120, true) || !CROWD_STATES.has(region.state) || !Array.isArray(region.points) || region.points.length < 3 || region.points.length > 100 || !region.points.every(point))) issues.push("invalid crowd region data");
  if (!Array.isArray(input.initiative?.entries) || !uniqueIds(input.initiative?.entries || []) || input.initiative.entries.some((entry) => !text(entry.name, 120, true) || !finite(entry.initiative, -1000, 1000))) issues.push("invalid initiative entries");
  [input.phases, input.families, input.tethers, input.spotlights, input.aoes, input.annotations, input.events, input.eventLog].forEach((items) => { if (!uniqueIds(items)) issues.push("object IDs must be unique"); });
  return [...new Set(issues)];
}

function normalizeState(raw, version = 1) {
  if (version !== 1) throw new Error("Unsupported encounter schema version");
  const base = defaultState();
  const state = { ...base, ...raw, battlefield: { ...base.battlefield, ...(raw?.battlefield || {}), anaglyph: { ...base.battlefield.anaglyph, ...(raw?.battlefield?.anaglyph || {}) } }, initiative: { ...base.initiative, ...(raw?.initiative || {}) } };
  state.presentation = { ...base.presentation, ...(raw?.presentation || {}), layers: { ...base.presentation.layers, ...(raw?.presentation?.layers || {}) } };
  if (state.presentation.measurement) { const m=state.presentation.measurement; state.presentation.measurement={...m,start:{...m.start,altitude:m.start.altitude??0},end:{...m.end,altitude:m.end.altitude??0},mode:m.mode||"2d",horizontal:m.horizontal??m.distance,vertical:m.vertical??0}; }
  state.tethers = state.tethers.map((item) => ({ ...item, style: item.style === "anaglyph" ? "anaglyph" : "normal" }));
  state.tokens = state.tokens.map((item) => ({ ...item, altitude: item.altitude ?? 0, presentationVisible: item.presentationVisible ?? item.visible }));
  ["spotlights", "aoes", "annotations"].forEach((key) => { state[key] = state[key].map((item) => ({ ...item, altitude: item.altitude ?? 0 })); });
  state.initiative.entries = state.initiative.entries.map((entry) => {
    const targetType = entry.targetType || (entry.tokenId ? "token" : undefined);
    const targetId = entry.targetId || entry.tokenId;
    const target = targetType === "crowd" ? state.crowdRegions.find((item) => item.id === targetId) : targetType === "token" ? state.tokens.find((item) => item.id === targetId) : undefined;
    return { ...entry, ...(targetType && targetId ? { targetType, targetId } : {}), name: target?.name || entry.name };
  });
  state.zones = state.zones.map((item) => ({ ...item, presentationVisible: item.presentationVisible ?? (item.visible && item.active) }));
  state.crowdRegions = state.crowdRegions.map((item) => ({ ...item, presentationVisible: item.presentationVisible ?? item.active }));
  const objects = [...state.tokens, ...state.zones, ...state.crowdRegions, ...state.aoes, ...state.spotlights, ...state.annotations, ...state.tethers];
  const legacyMembership = new Map();
  state.families.forEach((family) => (family.memberIds || []).forEach((id) => { if (!legacyMembership.has(id)) legacyMembership.set(id, family.id); }));
  state.families.forEach((family) => { family.memberIds = []; });
  objects.forEach((object) => {
    const familyId = state.families.some((family) => family.id === object.familyId) ? object.familyId : legacyMembership.get(object.id);
    object.familyId = state.families.some((family) => family.id === familyId) ? familyId : undefined;
    const family = state.families.find((item) => item.id === object.familyId);
    if (family && !family.memberIds.includes(object.id)) family.memberIds.push(object.id);
  });
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

function registerTacticalEncounterRoutes(app, requireDm, uploadImageSingle) {
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
    const result = db.prepare("INSERT INTO tactical_encounters (name,status,schema_version,state_json,created_by_user_id,created_at,updated_at) VALUES (?,?,1,?,?,?,?)").run(name, status, JSON.stringify(state), req.session.user.id, now, now);
    audit(req.session.user.id, "create", result.lastInsertRowid, `Created tactical encounter ${name}`);
    res.status(201).json({ encounter: serialize(db.prepare("SELECT * FROM tactical_encounters WHERE id = ?").get(result.lastInsertRowid)) });
  });
  app.get("/api/dm/encounters/:id", requireDm, (req, res) => {
    const id = parseId(req.params.id); if (!id) return res.status(400).json({ error: "Invalid encounter ID" });
    const row = db.prepare("SELECT * FROM tactical_encounters WHERE id = ? AND archived_at IS NULL").get(id);
    if (!row) return res.status(404).json({ error: "Encounter not found" });
    try { return res.json({ encounter: serialize(row) }); } catch { return res.status(500).json({ error: "Encounter state could not be loaded" }); }
  });
  app.post("/api/dm/encounters/:id/map", requireDm, uploadImageSingle.single("image"), async (req, res, next) => {
    try {
      const id = parseId(req.params.id); const row = id && db.prepare("SELECT * FROM tactical_encounters WHERE id=? AND archived_at IS NULL").get(id);
      if (!row) return res.status(404).json({ error: "Encounter not found" });
      if (!req.file) return res.status(400).json({ error: "Map image is required" });
      const asset = await storeTacticalImage(req.file, id, "maps");
      const state = normalizeState(JSON.parse(row.state_json), row.schema_version);
      const mapAssets = [...(state.battlefield.mapAssets || [])];
      if (state.battlefield.mapAsset && !mapAssets.some((item) => item.path === state.battlefield.mapAsset.path)) mapAssets.push(state.battlefield.mapAsset);
      mapAssets.push(asset);
      state.battlefield = { ...state.battlefield, backgroundImageUrl: asset.path, mapAsset: asset, mapAssets, mapName: asset.originalName, mapWidth: asset.width, mapHeight: asset.height };
      const now = new Date().toISOString(); db.prepare("UPDATE tactical_encounters SET state_json=?,updated_at=? WHERE id=?").run(JSON.stringify(state), now, id);
      audit(req.session.user.id, "map_upload", id, `Uploaded tactical map ${asset.originalName}`);
      res.status(201).json({ asset, encounter: serialize(db.prepare("SELECT * FROM tactical_encounters WHERE id=?").get(id)) });
    } catch (error) { next(error); }
  });
  app.delete("/api/dm/encounters/:id/map", requireDm, (req, res) => {
    const id = parseId(req.params.id); const row = id && db.prepare("SELECT * FROM tactical_encounters WHERE id=? AND archived_at IS NULL").get(id);
    if (!row) return res.status(404).json({ error: "Encounter not found" });
    const state = normalizeState(JSON.parse(row.state_json), row.schema_version); state.battlefield.backgroundImageUrl = ""; delete state.battlefield.mapAsset; delete state.battlefield.mapName;
    db.prepare("UPDATE tactical_encounters SET state_json=?,updated_at=? WHERE id=?").run(JSON.stringify(state), new Date().toISOString(), id); audit(req.session.user.id, "map_remove", id, "Removed tactical map"); res.status(204).end();
  });
  app.get("/api/dm/encounters/:id/map-assets", requireDm, (req, res) => {
    const id = parseId(req.params.id); const row = id && db.prepare("SELECT * FROM tactical_encounters WHERE id=? AND archived_at IS NULL").get(id);
    if (!row) return res.status(404).json({ error: "Encounter not found" });
    const state = normalizeState(JSON.parse(row.state_json), row.schema_version);
    const assets = [...(state.battlefield.mapAssets || [])];
    if (state.battlefield.mapAsset && !assets.some((item) => item.path === state.battlefield.mapAsset.path)) assets.push(state.battlefield.mapAsset);
    res.json({ assets });
  });
  app.post("/api/dm/encounters/:id/token-assets", requireDm, uploadImageSingle.single("image"), async (req, res, next) => {
    try { const id=parseId(req.params.id); const row=id&&db.prepare("SELECT id FROM tactical_encounters WHERE id=? AND archived_at IS NULL").get(id); if(!row)return res.status(404).json({error:"Encounter not found"}); if(!req.file)return res.status(400).json({error:"Token image is required"}); const asset=await storeTacticalImage(req.file,id,"tokens"); audit(req.session.user.id,"token_asset_upload",id,`Uploaded token portrait ${asset.originalName}`); res.status(201).json({asset}); } catch(error){ next(error); }
  });
  app.patch("/api/dm/encounters/:id", requireDm, (req, res) => {
    const id = parseId(req.params.id); if (!id) return res.status(400).json({ error: "Invalid encounter ID" });
    const row = db.prepare("SELECT * FROM tactical_encounters WHERE id = ? AND archived_at IS NULL").get(id); if (!row) return res.status(404).json({ error: "Encounter not found" });
    const name = req.body.name === undefined ? row.name : String(req.body.name).trim(); const status = req.body.status ?? row.status;
    let state; try { state = req.body.state === undefined ? normalizeState(JSON.parse(row.state_json), row.schema_version) : normalizeState(req.body.state, req.body.schemaVersion ?? 1); } catch (error) { return res.status(400).json({ error: error.message }); }
    const issues = [...(!text(name, 120, true) ? ["invalid name"] : []), ...(!STATUSES.has(status) ? ["invalid status"] : []), ...validateState(state)]; if (issues.length) return res.status(400).json({ error: "Invalid encounter", issues });
    const now = new Date().toISOString(); db.prepare("UPDATE tactical_encounters SET name=?,status=?,schema_version=1,state_json=?,updated_at=? WHERE id=?").run(name,status,JSON.stringify(state),now,id);
    res.json({ encounter: serialize(db.prepare("SELECT * FROM tactical_encounters WHERE id=?").get(id)) });
  });
  app.post("/api/dm/encounters/:id/duplicate", requireDm, (req, res) => {
    const id = parseId(req.params.id); const row = id && db.prepare("SELECT * FROM tactical_encounters WHERE id=? AND archived_at IS NULL").get(id); if (!row) return res.status(404).json({ error: "Encounter not found" });
    req.body = { name: `${row.name} (Copy)`, status: "prep", state: normalizeState(JSON.parse(row.state_json), row.schema_version) };
    const now = new Date().toISOString(); const result = db.prepare("INSERT INTO tactical_encounters (name,status,schema_version,state_json,created_by_user_id,created_at,updated_at) VALUES (?,?,1,?,?,?,?)").run(req.body.name,"prep",JSON.stringify(req.body.state),req.session.user.id,now,now);
    audit(req.session.user.id,"duplicate",result.lastInsertRowid,`Duplicated tactical encounter ${row.name}`); res.status(201).json({ encounter: serialize(db.prepare("SELECT * FROM tactical_encounters WHERE id=?").get(result.lastInsertRowid)) });
  });
  app.delete("/api/dm/encounters/:id", requireDm, (req, res) => { const id=parseId(req.params.id); const row=id&&db.prepare("SELECT name FROM tactical_encounters WHERE id=? AND archived_at IS NULL").get(id); if(!row)return res.status(404).json({error:"Encounter not found"}); const now=new Date().toISOString(); db.prepare("UPDATE tactical_encounters SET archived_at=?,archived_by_user_id=?,updated_at=? WHERE id=?").run(now,req.session.user.id,now,id); audit(req.session.user.id,"archive",id,`Archived tactical encounter ${row.name}`); res.status(204).end(); });
  app.get("/api/dm/encounters/:id/snapshots", requireDm, (req,res)=>{const id=parseId(req.params.id);if(!id)return res.status(400).json({error:"Invalid encounter ID"});res.json({snapshots:db.prepare("SELECT id,name,created_at AS createdAt FROM tactical_encounter_snapshots WHERE encounter_id=? ORDER BY created_at DESC").all(id)});});
  app.post("/api/dm/encounters/:id/snapshots", requireDm, (req,res)=>{const id=parseId(req.params.id);const row=id&&db.prepare("SELECT * FROM tactical_encounters WHERE id=? AND archived_at IS NULL").get(id);if(!row)return res.status(404).json({error:"Encounter not found"});const name=String(req.body?.name||`Snapshot ${new Date().toLocaleString()}`).trim().slice(0,120);const now=new Date().toISOString();const result=db.prepare("INSERT INTO tactical_encounter_snapshots (encounter_id,name,schema_version,state_json,created_by_user_id,created_at) VALUES (?,?,1,?,?,?)").run(id,name,row.state_json,req.session.user.id,now);res.status(201).json({snapshot:{id:result.lastInsertRowid,name,createdAt:now}});});
  app.post("/api/dm/encounters/:id/snapshots/:snapshotId/restore", requireDm, (req,res)=>{const id=parseId(req.params.id),sid=parseId(req.params.snapshotId);const snap=id&&sid&&db.prepare("SELECT * FROM tactical_encounter_snapshots WHERE id=? AND encounter_id=?").get(sid,id);if(!snap)return res.status(404).json({error:"Snapshot not found"});const state=normalizeState(JSON.parse(snap.state_json),snap.schema_version);const issues=validateState(state);if(issues.length)return res.status(422).json({error:"Snapshot is invalid",issues});const now=new Date().toISOString();db.prepare("UPDATE tactical_encounters SET schema_version=1,state_json=?,updated_at=? WHERE id=? AND archived_at IS NULL").run(JSON.stringify(state),now,id);audit(req.session.user.id,"snapshot_restore",id,`Restored snapshot ${snap.name}`);res.json({encounter:serialize(db.prepare("SELECT * FROM tactical_encounters WHERE id=?").get(id))});});
}

module.exports = { defaultState, normalizeState, registerTacticalEncounterRoutes, validateState };
