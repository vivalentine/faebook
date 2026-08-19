import type { Point,TacticalState } from "../types/tactical";
import { polygonCentroid } from "./tacticalPolygons.ts";

export const crowdAnchorPoint=(points:Point[])=>polygonCentroid(points);

export function tetherEndpoint(state:TacticalState,{tokenId,crowdId,fallback}:{tokenId?:string;crowdId?:string;fallback?:Point},overrides:Record<string,Point[]>={}){
  const token=tokenId&&state.tokens.find(item=>item.id===tokenId);
  if(token)return{x:token.x,y:token.y};
  const crowd=crowdId&&state.crowdRegions.find(item=>item.id===crowdId);
  return crowd?crowdAnchorPoint(overrides[crowd.id]??crowd.points):fallback;
}
