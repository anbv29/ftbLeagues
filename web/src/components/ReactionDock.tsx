import { REACTIONS } from "../../../src/rooms/protocol";
import type { Reaction } from "../types";

export function ReactionDock({
  onReact,
  canReact,
}: {
  onReact: (emoji: Reaction) => void;
  canReact: boolean;
}) {
  return (
    <div className="reaction-dock" aria-label="Send a reaction">
      <span className="dock-label">React</span>
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="reaction-btn"
          onClick={() => onReact(emoji)}
          disabled={!canReact}
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
