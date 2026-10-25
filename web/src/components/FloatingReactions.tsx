import type { CSSProperties } from "react";
import type { FloatingReaction } from "../lib/useRoom";

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) % 9973;
  }
  return result;
}

export function FloatingReactions({
  reactions,
}: {
  reactions: FloatingReaction[];
}) {
  return (
    <div className="reaction-layer" aria-hidden="true">
      {reactions.map((reaction) => {
        const seed = hash(reaction.id);
        const left = 8 + (seed % 84);
        const drift = (seed % 60) - 30;
        const rotate = (seed % 44) - 22;

        return (
          <span
            key={reaction.id}
            className="floating-reaction"
            style={
              {
                "--x": `${left}%`,
                "--drift": `${drift}px`,
                "--rot": `${rotate}deg`,
              } as CSSProperties
            }
          >
            <span className="floating-emoji">{reaction.emoji}</span>
            <span className="floating-name">{reaction.nickname}</span>
          </span>
        );
      })}
    </div>
  );
}
