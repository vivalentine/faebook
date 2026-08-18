import type { Point } from "../types/tactical";

export const polygonArea = (points: Point[]) => Math.abs(points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length];
  return sum + point.x * next.y - next.x * point.y;
}, 0)) / 2;

export function polygonCentroid(points: Point[]): Point {
  if (!points.length) return { x: 0, y: 0 };
  const signed = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  if (Math.abs(signed) < 1e-8) return { x: points.reduce((n,p)=>n+p.x,0)/points.length, y: points.reduce((n,p)=>n+p.y,0)/points.length };
  let x=0,y=0;
  points.forEach((point,index)=>{const next=points[(index+1)%points.length],cross=point.x*next.y-next.x*point.y;x+=(point.x+next.x)*cross;y+=(point.y+next.y)*cross});
  return { x:x/(3*signed), y:y/(3*signed) };
}

export function normalizePolygonArea(points: Point[], targetArea: number): Point[] {
  const area=polygonArea(points);
  if (area < 1e-6 || targetArea < 1e-6) throw new Error("Surge polygon must have a non-zero area");
  const center=polygonCentroid(points),scale=Math.sqrt(targetArea/area);
  return points.map(point=>({x:center.x+(point.x-center.x)*scale,y:center.y+(point.y-center.y)*scale}));
}

export function resamplePolygon(points: Point[], count: number): Point[] {
  if (points.length<2||count<=0)return [];
  const lengths=points.map((point,index)=>Math.hypot(points[(index+1)%points.length].x-point.x,points[(index+1)%points.length].y-point.y));
  const perimeter=lengths.reduce((sum,n)=>sum+n,0);if(perimeter<1e-8)return Array.from({length:count},()=>({...points[0]}));
  return Array.from({length:count},(_,sample)=>{let distance=perimeter*sample/count,index=0;while(distance>lengths[index]&&index<lengths.length-1){distance-=lengths[index];index++}const start=points[index],end=points[(index+1)%points.length],ratio=lengths[index]?distance/lengths[index]:0;return{x:start.x+(end.x-start.x)*ratio,y:start.y+(end.y-start.y)*ratio}});
}

export function interpolatePolygons(from:Point[],to:Point[],progress:number):Point[]{const count=Math.max(from.length,to.length),a=resamplePolygon(from,count),b=resamplePolygon(to,count),t=Math.max(0,Math.min(1,progress));return a.map((point,index)=>({x:point.x+(b[index].x-point.x)*t,y:point.y+(b[index].y-point.y)*t}))}
