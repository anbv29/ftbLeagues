import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Team } from "../types";
import { teamInitials } from "../lib/format";

function teamHue(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  }
  return hash;
}

interface TeamCrestProps {
  team: Team;
  size?: "sm" | "md" | "lg";
}

export function TeamCrest({ team, size = "md" }: TeamCrestProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [team.crest]);

  const initials = teamInitials(team.name, team.shortName);
  const style = {
    "--crest-hue": teamHue(team.name),
  } as CSSProperties;

  if (!team.crest || failed) {
    return (
      <span
        className={`crest crest-${size} crest-fallback`}
        style={style}
        aria-label={`${team.name} crest`}
        role="img"
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      className={`crest crest-${size}`}
      src={team.crest}
      alt={`${team.name} crest`}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
