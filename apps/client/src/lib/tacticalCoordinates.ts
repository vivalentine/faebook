import type { Point } from "../types/tactical";

export type TacticalCamera = { zoom:number; panX:number; panY:number };
export type BattlefieldBounds = Pick<DOMRect,"left"|"top">;

export function screenToWorld(clientX:number, clientY:number, bounds:BattlefieldBounds, camera:TacticalCamera):Point {
  return { x:(clientX-bounds.left-camera.panX)/camera.zoom, y:(clientY-bounds.top-camera.panY)/camera.zoom };
}
export function worldToScreen(x:number, y:number, bounds:BattlefieldBounds, camera:TacticalCamera):Point {
  return { x:bounds.left+camera.panX+x*camera.zoom, y:bounds.top+camera.panY+y*camera.zoom };
}
export function zoomAtPoint(camera:TacticalCamera, screen:Point, bounds:BattlefieldBounds, nextZoom:number):TacticalCamera {
  const world=screenToWorld(screen.x,screen.y,bounds,camera);
  return { zoom:nextZoom, panX:screen.x-bounds.left-world.x*nextZoom, panY:screen.y-bounds.top-world.y*nextZoom };
}
export function snapPoint(point:Point, size:number, offset:Point, enabled:boolean):Point {
  if(!enabled)return point;
  return {x:Math.round((point.x-offset.x)/size)*size+offset.x,y:Math.round((point.y-offset.y)/size)*size+offset.y};
}
