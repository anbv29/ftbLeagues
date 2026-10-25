import { describe, expect, it } from "vitest";
import { parseClockDisplay } from "../src/domain/clock";

describe("parseClockDisplay", () => {
  it("parses a regular minute", () => {
    expect(parseClockDisplay("79'", 4740)).toEqual({
      minute: 79,
      addedTime: 0,
      display: "79'",
    });
  });

  it("parses stoppage time", () => {
    expect(parseClockDisplay("45'+2'", 2700)).toEqual({
      minute: 45,
      addedTime: 2,
      display: "45'+2'",
    });
    expect(parseClockDisplay("90'+12'", 5400)).toEqual({
      minute: 90,
      addedTime: 12,
      display: "90'+12'",
    });
  });

  it("supports extra time", () => {
    expect(parseClockDisplay("120'+1'", 7200)).toEqual({
      minute: 120,
      addedTime: 1,
      display: "120'+1'",
    });
  });

  it("falls back to elapsed seconds when the display is empty", () => {
    expect(parseClockDisplay("", 2700)).toEqual({
      minute: 45,
      addedTime: 0,
      display: "45'",
    });
    expect(parseClockDisplay(undefined, 0)).toEqual({
      minute: 0,
      addedTime: 0,
      display: "0'",
    });
  });

  it("ignores unparseable displays but keeps them for the UI", () => {
    expect(parseClockDisplay("half time", 5400)).toEqual({
      minute: 90,
      addedTime: 0,
      display: "half time",
    });
  });

  it("never returns a negative minute", () => {
    expect(parseClockDisplay(undefined, -90).minute).toBe(0);
  });
});
