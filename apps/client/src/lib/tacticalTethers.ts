import type { Point,TacticalState,TacticalTether } from "../types/tactical";
import { polygonCentroid } from "./tacticalPolygons.ts";

export const DEFAULT_ANAGLYPH_SETTINGS={separation:6,opacity:.45,strokeWidth:2,red:"#ff1744",cyan:"#00e5ff"} as const;
/** Returns channel endpoints in map coordinates while calibrating separation in screen pixels. */
export function anaglyphChannelLines(a:Point,b:Point,separation:number,zoom:number){
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  const offset=length?(separation/2)/Math.max(zoom,.0001):0,ox=length?-dy/length*offset:0,oy=length?dx/length*offset:0;
  return {red:{a:{x:a.x+ox,y:a.y+oy},b:{x:b.x+ox,y:b.y+oy}},cyan:{a:{x:a.x-ox,y:a.y-oy},b:{x:b.x-ox,y:b.y-oy}}};
}

export type TetherEnd="from"|"to";
export type TetherEndpointType="token"|"crowd"|"zone"|"aoe"|"free";
export const crowdAnchorPoint=(points:Point[])=>polygonCentroid(points);

/** The single source of truth for attached and free tether endpoint positions. */
export function resolveTetherEndpoint(state:TacticalState,tether:TacticalTether,end:TetherEnd,crowdPointOverrides:Record<string,Point[]>={}){
  const tokenId=tether[`${end}TokenId`],crowdId=tether[`${end}CrowdId`],zoneId=tether[`${end}ZoneId`],aoeId=tether[`${end}AoeId`];
  const token=tokenId&&state.tokens.find(item=>item.id===tokenId); if(token)return{x:token.x,y:token.y};
  const crowd=crowdId&&state.crowdRegions.find(item=>item.id===crowdId); if(crowd)return crowdAnchorPoint(crowdPointOverrides[crowd.id]??crowd.points);
  const zone=zoneId&&state.zones.find(item=>item.id===zoneId); if(zone)return polygonCentroid(zone.points);
  const aoe=aoeId&&state.aoes.find(item=>item.id===aoeId); if(aoe)return{x:aoe.x,y:aoe.y};
  return tether[end];
}
export function clearTetherEndpointAttachment<T extends TacticalTether>(tether:T,end:TetherEnd){
  delete tether[`${end}TokenId`]; delete tether[`${end}CrowdId`]; delete tether[`${end}ZoneId`]; delete tether[`${end}AoeId`]; delete tether[end]; return tether;
}
export const tetherEndpointType=(t:TacticalTether,end:TetherEnd):TetherEndpointType=>t[`${end}TokenId`]?"token":t[`${end}CrowdId`]?"crowd":t[`${end}ZoneId`]?"zone":t[`${end}AoeId`]?"aoe":"free";
export const tetherEndIsAttached=(t:TacticalTether,end:TetherEnd)=>tetherEndpointType(t,end)!=="free";
/** Backwards-compatible adapter for older callers. */
export function tetherEndpoint(state:TacticalState,{tokenId,crowdId,zoneId,aoeId,fallback}:{tokenId?:string;crowdId?:string;zoneId?:string;aoeId?:string;fallback?:Point},overrides:Record<string,Point[]>={}){return resolveTetherEndpoint(state,{id:"",category:"anchor",active:true,fromTokenId:tokenId,fromCrowdId:crowdId,fromZoneId:zoneId,fromAoeId:aoeId,from:fallback},"from",overrides)}
