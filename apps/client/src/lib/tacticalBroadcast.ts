import type { TacticalState } from "../types/tactical";
export type TacticalMessage={type:"state";state:TacticalState}|{type:"positions";positions:Record<string,{x:number;y:number}>}|{type:"hello"}|{type:"presence"};
export const tacticalChannelName=(id:string|number)=>`faebook-tactical-encounter-${id}`;
export function createTacticalChannel(id:string|number){return "BroadcastChannel" in window?new BroadcastChannel(tacticalChannelName(id)):null}
