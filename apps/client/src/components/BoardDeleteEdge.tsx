import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { BoardEdge } from "../types";

function BoardDeleteEdge({
  id,
  data,
  selected,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps<BoardEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />

      <EdgeLabelRenderer>
        <div
          className="board-edge-label-shell nopan"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          <input
            type="text"
            className="board-edge-label-input nodrag nopan"
            placeholder="relationship..."
            value={data?.label ?? ""}
            onChange={(event) => data?.onLabelChange?.(id, event.target.value)}
          />

          {selected ? (
            <button
              type="button"
              className="board-edge-delete-button nodrag nopan"
              onClick={() => data?.onDelete?.(id)}
            >
              Remove
            </button>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(BoardDeleteEdge);