import type { EncounterPhase,TacticalState,TacticalToken } from "../types/tactical";

/** Explicit object rules win over the active phase's family rule, then persisted visibility. */
export function tokenIsPresented(token:TacticalToken,phase?:EncounterPhase):boolean {
  if(token.presentationRule==="show")return true;
  if(token.presentationRule==="hide")return false;
  if(token.familyId&&phase?.showPresentationFamilyIds?.includes(token.familyId))return true;
  if(token.familyId&&phase?.hidePresentationFamilyIds?.includes(token.familyId))return false;
  if(phase?.showPresentationTokenIds?.includes(token.id))return true;
  if(phase?.hidePresentationTokenIds?.includes(token.id))return false;
  return token.presentationVisible!==false;
}

export function presentedTokenIds(state:TacticalState):Set<string>{
  const phase=state.phases.find(item=>item.id===state.activePhaseId);
  return new Set(state.tokens.filter(token=>token.visible&&tokenIsPresented(token,phase)).map(token=>token.id));
}

export const tokenLabelIsPresented=(token:TacticalToken,state:TacticalState,mode:"dm"|"presentation")=>mode==="dm"||(state.presentation?.layers.tokenLabels!=="off"&&token.presentationLabelVisible!==false);
