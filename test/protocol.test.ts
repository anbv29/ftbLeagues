import { describe, expect, it } from "vitest";
import { generateRoomCode, isRoomCode } from "../src/domain/room-code";
import {
  MAX_NICKNAME_LENGTH,
  cleanNickname,
  parseClientMessage,
} from "../src/rooms/protocol";

describe("cleanNickname", () => {
  it("trims, strips control characters and caps the length", () => {
    const nickname = cleanNickname(`  ${"a".repeat(40)}\u0007  `);
    expect(nickname).toHaveLength(MAX_NICKNAME_LENGTH);
    expect(nickname).not.toContain("\u0007");
  });

  it("falls back to Guest for empty or non-string values", () => {
    expect(cleanNickname("   ")).toBe("Guest");
    expect(cleanNickname(42)).toBe("Guest");
    expect(cleanNickname(null)).toBe("Guest");
  });
});

describe("parseClientMessage", () => {
  it("parses hello and normalizes the nickname", () => {
    expect(parseClientMessage('{"type":"hello","nickname":"  Ada  "}')).toEqual({
      type: "hello",
      nickname: "Ada",
    });
  });

  it("parses ping", () => {
    expect(parseClientMessage('{"type":"ping"}')).toEqual({ type: "ping" });
  });

  it("accepts only known reactions", () => {
    expect(
      parseClientMessage('{"type":"reaction","emoji":"⚽"}'),
    ).toEqual({ type: "reaction", emoji: "⚽" });
    expect(
      parseClientMessage('{"type":"reaction","emoji":"💣"}'),
    ).toBeNull();
  });

  it("rejects malformed or unknown messages", () => {
    expect(parseClientMessage("not json")).toBeNull();
    expect(parseClientMessage("null")).toBeNull();
    expect(parseClientMessage('{"type":"chat","text":"hi"}')).toBeNull();
    expect(parseClientMessage('"hello"')).toBeNull();
  });
});

describe("room codes", () => {
  it("generates six unambiguous characters", () => {
    for (let index = 0; index < 50; index += 1) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(isRoomCode(code)).toBe(true);
    }
  });

  it("rejects lookalike characters and wrong lengths", () => {
    expect(isRoomCode("ABC0IO")).toBe(false);
    expect(isRoomCode("ABC12")).toBe(false);
    expect(isRoomCode("abc234")).toBe(false);
  });
});
