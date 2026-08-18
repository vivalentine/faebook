import type { EncounterPhase, FamilyMutation, Point, TacticalAoe, TacticalFamily, TacticalState, ThresholdRule } from "../types/tactical";

export const MIN_POLYGON_VERTICES = 3;
export const distance = (a: Point, b: Point) => Math.hypot(b.x-a.x,b.y-a.y);
export const translatePoints = (points: Point[], d: Point) => points.map(p=>({x:p.x+d.x,y:p.y+d.y}));
export const moveVertex = (points: Point[], index: number, point: Point) => points.map((p,i)=>i===index?point:p);
export function insertVertex(points:Point[], edge:number, point?:Point){if(!points.length)return points;const a=points[edge],b=points[(edge+1)%points.length],p=point??{x:(a.x+b.x)/2,y:(a.y+b.y)/2};return [...points.slice(0,edge+1),p,...points.slice(edge+1)]}
export const removeVertex=(points:Point[],index:number)=>points.length<=MIN_POLYGON_VERTICES?points:points.filter((_,i)=>i!==index);
const rotate=(p:Point,degrees:number)=>{const r=degrees*Math.PI/180;return{x:p.x*Math.cos(r)-p.y*Math.sin(r),y:p.x*Math.sin(r)+p.y*Math.cos(r)}};
export function resizeAoe(a:TacticalAoe,p:Point){const d={x:p.x-a.x,y:p.y-a.y},local=rotate(d,-(a.rotation??0));if(a.shape==="line")return{...a,size:Math.max(5,local.x),width:Math.max(5,Math.abs(local.y)*2)};if(a.shape==="square"){const size=Math.max(5,Math.max(Math.abs(local.x),Math.abs(local.y))*2);return{...a,size,width:size}}if(a.shape==="rectangle")return{...a,size:Math.max(5,Math.abs(local.x)*2),width:Math.max(5,Math.abs(local.y)*2)};return{...a,size:Math.max(5,Math.hypot(d.x,d.y))}}
export const rotateAoe=(a:TacticalAoe,p:Point)=>({...a,rotation:Math.atan2(p.y-a.y,p.x-a.x)*180/Math.PI});
export const waypointDistance=(points:Point[],grid:number,units:number)=>points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0)/grid*units;
export function objectsInRect(s:TacticalState,a:Point,b:Point){const x1=Math.min(a.x,b.x),x2=Math.max(a.x,b.x),y1=Math.min(a.y,b.y),y2=Math.max(a.y,b.y),inside=(p:Point)=>p.x>=x1&&p.x<=x2&&p.y>=y1&&p.y<=y2;return [...s.tokens.filter(t=>t.visible&&t.x+t.size/2>=x1&&t.x-t.size/2<=x2&&t.y+t.size/2>=y1&&t.y-t.size/2<=y2).map(x=>x.id),...s.aoes.filter(inside).map(x=>x.id),...s.spotlights.filter(inside).map(x=>x.id),...s.annotations.filter(inside).map(x=>x.id),...s.zones.filter(z=>z.points.some(inside)).map(x=>x.id),...s.crowdRegions.filter(z=>z.points.some(inside)).map(x=>x.id)]}
export function detectStacks(points:Array<Point&{id:string}>,tolerance:number){const remaining=new Set(points.map(x=>x.id)),result:string[][]=[];for(const p of points){if(!remaining.has(p.id))continue;const group=points.filter(o=>remaining.has(o.id)&&distance(p,o)<=tolerance).map(x=>x.id);group.forEach(id=>remaining.delete(id));if(group.length>1)result.push(group)}return result}
export const fanOut=(center:Point,ids:string[],radius=45)=>Object.fromEntries(ids.map((id,i)=>[id,{x:center.x+Math.cos(i/ids.length*Math.PI*2)*radius,y:center.y+Math.sin(i/ids.length*Math.PI*2)*radius}]));
export const applyThresholdRules=(pressure:number,rules:ThresholdRule[])=>(rules??[]).filter(r=>r.enabled&&(r.comparison==="below"?pressure<r.threshold:pressure>=r.threshold)).map(r=>r.mutation);
export function applyFamilyMutation(s:TacticalState,id:string,m:FamilyMutation){const f=s.families.find(x=>x.id===id);if(!f)return s;const patch=(items:Array<{id:string;familyId?:string;visible?:boolean;presentationVisible?:boolean;locked?:boolean;active?:boolean}>)=>items.forEach(x=>{if(x.familyId!==id&&!f.memberIds.includes(x.id))return;if(m.visible!=null&&"visible"in x)x.visible=m.visible;if(m.presentationVisible!=null)x.presentationVisible=m.presentationVisible;if(m.locked!=null)x.locked=m.locked;if(m.active!=null&&"active"in x)x.active=m.active});[s.tokens,s.zones,s.crowdRegions,s.aoes,s.spotlights,s.annotations,s.tethers].forEach(x=>patch(x));f.active=m.active??f.active;return s}
export function applyObjectMutation(s:TacticalState,id:string,m:FamilyMutation&{pressure?:number;crowdState?:TacticalState["crowdRegions"][number]["state"]}){
  const objects=[...s.tokens,...s.zones,...s.crowdRegions,...s.aoes,...s.spotlights,...s.annotations,...s.tethers];
  const object=objects.find(x=>x.id===id) as (typeof objects[number]&{pressure?:number;state?:string})|undefined;
  if(!object)return s;
  if(m.visible!=null&&"visible"in object)object.visible=m.visible;
  if(m.presentationVisible!=null)object.presentationVisible=m.presentationVisible;
  if(m.locked!=null)object.locked=m.locked;
  if(m.active!=null&&"active"in object)object.active=m.active;
  if(m.pressure!=null&&"pressure"in object)object.pressure=m.pressure;
  if(m.crowdState!=null&&"state"in object)object.state=m.crowdState;
  return s;
}
export function applyPhase(s:TacticalState,p:EncounterPhase){s.activePhaseId=p.id;(p.mutations??[]).forEach(m=>m.targetType==="family"?applyFamilyMutation(s,m.targetId,m.changes):applyObjectMutation(s,m.targetId,m.changes));return s}
export const familyMembers=(s:TacticalState,f:TacticalFamily)=>{const ids=new Set(f.memberIds);return[...s.tokens,...s.zones,...s.crowdRegions,...s.aoes,...s.spotlights,...s.annotations,...s.tethers].filter(x=>ids.has(x.id)||x.familyId===f.id)};

export type TacticalSelection = { kind:"token"|"zone"|"crowd"|"aoe"|"spotlight"|"annotation"|"tether"; id:string };
export const selectionKey=(selection:TacticalSelection)=>`${selection.kind}:${selection.id}`;
export function toggleSelection(current:TacticalSelection[],next:TacticalSelection,modifier:boolean){if(!modifier)return[next];const key=selectionKey(next);return current.some(x=>selectionKey(x)===key)?current.filter(x=>selectionKey(x)!==key):[...current,next]}
export function selectionsInRect(s:TacticalState,a:Point,b:Point):TacticalSelection[]{const ids=new Set(objectsInRect(s,a,b));return[...s.tokens.map(x=>({kind:"token" as const,id:x.id})),...s.aoes.map(x=>({kind:"aoe" as const,id:x.id})),...s.spotlights.map(x=>({kind:"spotlight" as const,id:x.id})),...s.annotations.map(x=>({kind:"annotation" as const,id:x.id})),...s.zones.map(x=>({kind:"zone" as const,id:x.id})),...s.crowdRegions.map(x=>({kind:"crowd" as const,id:x.id}))].filter(x=>ids.has(x.id))}
export function moveSelections(s:TacticalState,selections:TacticalSelection[],delta:Point){const keys=new Set(selections.map(selectionKey)),move=<T extends Point&{id:string;locked?:boolean}>(kind:TacticalSelection["kind"],items:T[])=>items.forEach(x=>{if(keys.has(`${kind}:${x.id}`)&&!x.locked){x.x+=delta.x;x.y+=delta.y}});move("token",s.tokens);move("aoe",s.aoes);move("spotlight",s.spotlights);move("annotation",s.annotations);for(const [kind,items] of [["zone",s.zones],["crowd",s.crowdRegions]] as const)items.forEach(x=>{if(keys.has(`${kind}:${x.id}`)&&!x.locked)x.points=translatePoints(x.points,delta)});return s}
export type TacticalHistory={past:TacticalState[];present:TacticalState;future:TacticalState[]};
export const commitHistory=(history:TacticalHistory,next:TacticalState):TacticalHistory=>({past:[...history.past,structuredClone(history.present)],present:structuredClone(next),future:[]});
export const undoHistory=(history:TacticalHistory):TacticalHistory=>history.past.length?{past:history.past.slice(0,-1),present:structuredClone(history.past.at(-1)!),future:[structuredClone(history.present),...history.future]}:history;
export const redoHistory=(history:TacticalHistory):TacticalHistory=>history.future.length?{past:[...history.past,structuredClone(history.present)],present:structuredClone(history.future[0]),future:history.future.slice(1)}:history;
export const createCheckpoint=(state:TacticalState,label:string,id=crypto.randomUUID(),at=new Date().toISOString())=>({id,label,createdAt:at,state:structuredClone(state)});
