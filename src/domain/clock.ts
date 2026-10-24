/**
 * Clock string parsing shared by scoreboard and summary payloads.
 *
 * Football clocks are not numbers: "45'+2'" and "90'+5'" carry two pieces of
 * information. Raw elapsed seconds cannot distinguish 90' from 90'+5', so the
 * display string wins whenever it exists.
 */

export interface ClockDisplay {
  minute: number;
  addedTime: number;
  display: string;
}

export function parseClockDisplay(
  display: string | null | undefined,
  elapsedSeconds = 0,
): ClockDisplay {
  let minute = Math.max(0, Math.floor(elapsedSeconds / 60));
  let addedTime = 0;

  const parsed = /^(\d+)(?:'\+(\d+))?/.exec(display ?? "");
  if (parsed) {
    const minutes = parsed[1];
    if (minutes !== undefined) minute = Number(minutes);
    addedTime = parsed[2] === undefined ? 0 : Number(parsed[2]);
  }

  return {
    minute,
    addedTime,
    display: display && display.length > 0 ? display : `${minute}'`,
  };
}
