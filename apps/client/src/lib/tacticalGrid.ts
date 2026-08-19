import type { Point,TacticalState } from "../types/tactical";
type Battlefield=TacticalState["battlefield"];
export const snapPointToGrid=(point:Point,battlefield:Battlefield):Point=>({x:Math.round((point.x-battlefield.gridOffsetX)/battlefield.gridSize)*battlefield.gridSize+battlefield.gridOffsetX,y:Math.round((point.y-battlefield.gridOffsetY)/battlefield.gridSize)*battlefield.gridSize+battlefield.gridOffsetY});
export const snapLengthToGrid=(value:number,battlefield:Battlefield,minimum=battlefield.gridSize):number=>Math.max(minimum,Math.round(value/battlefield.gridSize)*battlefield.gridSize);
