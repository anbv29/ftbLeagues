import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  MAX_NICKNAME_LENGTH,
  REACTIONS,
  cleanNickname,
} from "../../../src/rooms/protocol";
import { initials } from "../lib/format";
import type { PresenceState, Reaction } from "../types";
import { ShareIcon, UsersIcon } from "./Icons";

function avatarHue(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  }
  return hash;
}

interface RoomPanelProps {
  presence: PresenceState;
  roomCode: string | null;
  nickname: string;
  onNickname: (nickname: string) => void;
  onShare: () => void;
  sharing: boolean;
  onReact: (emoji: Reaction) => void;
  canReact: boolean;
}

export function RoomPanel({
  presence,
  roomCode,
  nickname,
  onNickname,
  onShare,
  sharing,
  onReact,
  canReact,
}: RoomPanelProps) {
  const [draft, setDraft] = useState(nickname);

  useEffect(() => setDraft(nickname), [nickname]);

  const commit = () => {
    const cleaned = cleanNickname(draft);
    setDraft(cleaned);
    if (cleaned !== nickname) onNickname(cleaned);
  };

  const members = presence.members.slice(0, 3);
  const extra = presence.members.length - members.length;

  return (
    <section className="room-panel">
      <header className="room-panel-head">
        <div>
          <p className="eyebrow">Together</p>
          <h2>The room</h2>
        </div>
        <span className="presence-count">
          <UsersIcon />
          {presence.count}
        </span>
      </header>

      <div className="presence">
        <div className="avatar-stack">
          {presence.members.slice(0, 4).map((member) => (
            <span
              key={member}
              className="avatar"
              style={{ "--avatar-hue": avatarHue(member) } as CSSProperties}
              title={member}
            >
              {initials(member)}
            </span>
          ))}
          {extra > 0 ? <span className="avatar avatar-more">+{extra}</span> : null}
          {presence.members.length === 0 ? (
            <span className="avatar avatar-empty">?</span>
          ) : null}
        </div>
        <p>
          {presence.count === 0
            ? "Connecting to the room…"
            : presence.count === 1
              ? "You're the first one here."
              : `${members.join(", ")}${extra > 0 ? ` +${extra}` : ""} watching.`}
        </p>
      </div>

      <label className="nickname-field">
        <span>You&apos;re in as</span>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          maxLength={MAX_NICKNAME_LENGTH}
          placeholder="Guest"
          autoComplete="nickname"
          spellCheck={false}
        />
      </label>

      <div className="room-code-row">
        <div className="room-code">
          <span>Invite code</span>
          <strong>{roomCode ?? "PUBLIC"}</strong>
        </div>
        <button
          className="invite-btn"
          type="button"
          onClick={onShare}
          disabled={sharing}
        >
          <ShareIcon />
          {sharing ? "Creating" : roomCode ? "Invite" : "Create link"}
        </button>
      </div>

      <div className="reaction-block">
        <div className="reaction-head">
          <span>Send a reaction</span>
          <small>{canReact ? "Live to the room" : "Waiting for the feed"}</small>
        </div>
        <div className="reaction-grid">
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
      </div>

      <p className="room-note">
        <span className="live-dot" aria-hidden="true" />
        Presence and reactions are pushed over the same live socket.
      </p>
    </section>
  );
}
