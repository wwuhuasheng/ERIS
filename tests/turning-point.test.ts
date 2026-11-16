import { describe, expect, it } from "vitest";
import { initialState } from "../lib/state";
import { shouldMarkTurningPoint } from "../lib/turning-point";

describe("turning point selection", () => {
  it("keeps model candidates to three", () => {
    expect(shouldMarkTurningPoint(initialState, initialState, true, 1, 0)).toBe(true);
    expect(shouldMarkTurningPoint(initialState, initialState, true, 9, 3)).toBe(false);
  });

  it("finds a state shift when the model marks none", () => {
    expect(shouldMarkTurningPoint(initialState, { ...initialState, tension: 53 }, false, 4, 0)).toBe(true);
    expect(shouldMarkTurningPoint(initialState, { ...initialState, tension: 53 }, false, 3, 0)).toBe(false);
  });

  it("keeps a long conversation rewindable without inventing extra points", () => {
    expect(shouldMarkTurningPoint(initialState, initialState, false, 8, 0)).toBe(true);
    expect(shouldMarkTurningPoint(initialState, initialState, false, 8, 1)).toBe(false);
  });
});
