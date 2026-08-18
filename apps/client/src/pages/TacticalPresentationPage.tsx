import { useCallback,useEffect,useRef,useState } from "react";
import { useParams } from "react-router-dom";
import TacticalBattlefield from "../components/tactical/TacticalBattlefield";
import { apiFetch } from "../lib/api";
import { createTacticalChannel,type TacticalMessage } from "../lib/tacticalBroadcast";
import type { TacticalEncounter,TacticalState } from "../types/tactical";

export default function TacticalPresentationPage(){
 const {encounterId=""}=useParams();const [encounter,setEncounter]=useState<TacticalEncounter|null>(null),[state,setState]=useState<TacticalState|null>(null),[connected,setConnected]=useState(false),[overlay,setOverlay]=useState(true);const timer=useRef<number|undefined>(undefined);
 const load=useCallback(async()=>{const r=await apiFetch(`/api/dm/encounters/${encounterId}`),d=await r.json();if(!r.ok)throw new Error(d.error);setEncounter(d.encounter);setState(d.encounter.state)},[encounterId]);
 useEffect(()=>{const initialLoad=window.setTimeout(()=>void load(),0);const channel=createTacticalChannel(encounterId);if(!channel)return;channel.onmessage=(event:MessageEvent<TacticalMessage>)=>{setConnected(true);if(event.data.type==="state")setState(current=>{if(!current)return event.data.type==="state"?event.data.state:current;if(event.data.type!=="state")return current;if(current.presentation?.frozen&&event.data.state.presentation?.frozen)return {...current,presentation:{...current.presentation,blackout:!!event.data.state.presentation.blackout}};return event.data.state});if(event.data.type==="positions")setState(s=>s?{...s,tokens:s.tokens.map(t=>event.data.type==="positions"&&event.data.positions[t.id]?{...t,...event.data.positions[t.id]}:t)}:s);if(event.data.type==="hello")channel.postMessage({type:"presence"})};channel.postMessage({type:"hello"});return()=>{window.clearTimeout(initialLoad);channel.close()}},[encounterId,load]);
 function revealOverlay(){setOverlay(true);window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>setOverlay(false),3000)}
 if(!state)return <main className="presentation-loading">Preparing player display…</main>;
 const camera=state.battlefield.presentationCamera||{zoom:.75,panX:40,panY:40};
 return <main className={`tactical-presentation ${state.presentation?.blackout?"blackout":""}`} onPointerMove={revealOverlay} onKeyDown={revealOverlay}>{state.presentation?.blackout?<div className="blackout-card"><span>✦</span><h1>{encounter?.name}</h1></div>:<TacticalBattlefield state={state} mode="presentation" zoom={camera.zoom} pan={{x:camera.panX,y:camera.panY}}/>}<div className={`presenter-overlay ${overlay?"visible":""}`}><span>{connected?"Live":"Waiting for DM"}</span><button onClick={()=>document.documentElement.requestFullscreen?.()}>Fullscreen</button><button onClick={()=>void load()}>Reconnect</button></div></main>
}
