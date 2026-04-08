import {
  Handle,
  Position,
  NodeToolbar,
  type NodeProps,
} from "@xyflow/react";
import type { BoardNode } from "../types";

export default function BoardCardNode({
  id,
  data,
  selected,
}: NodeProps<BoardNode>) {
  const isNote = data.kind === "note";

  return (
    <div className={`board-node ${isNote ? "note-node" : "npc-node"}`}>
      <NodeToolbar isVisible={selected}>
        <button
          className="board-node-delete-button nodrag"
          type="button"
          onClick={() => data.onDelete?.(id)}
        >
          Remove
        </button>
      </NodeToolbar>

      <Handle type="target" position={Position.Top} />

      {data.imageUrl ? (
        <div className="board-node-image-wrap">
          <img className="board-node-image" src={data.imageUrl} alt={data.title} />
        </div>
      ) : null}

      <div className="board-node-body">
        {isNote ? (
          <>
            <input
              className="board-node-input nodrag"
              type="text"
              value={data.title}
              placeholder="Note title"
              onChange={(event) => data.onTitleChange?.(id, event.target.value)}
            />
            <textarea
              className="board-node-textarea nodrag"
              value={data.body ?? ""}
              placeholder="Type your note here..."
              rows={5}
              onChange={(event) => data.onBodyChange?.(id, event.target.value)}
            />
          </>
        ) : (
          <>
            <h3>{data.title}</h3>
            {data.body ? <p>{data.body}</p> : null}
          </>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}