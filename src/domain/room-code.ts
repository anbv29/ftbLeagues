/**
 * Share codes.
 *
 * Six characters from an alphabet without O/0 or I/1: short enough to say out
 * loud, unambiguous enough to type from a screenshot.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(length = ROOM_CODE_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let code = "";
  for (const byte of bytes) {
    code += ALPHABET[byte % ALPHABET.length];
  }
  return code;
}

export function isRoomCode(value: string): boolean {
  return (
    value.length === ROOM_CODE_LENGTH &&
    [...value].every((character) => ALPHABET.includes(character))
  );
}
