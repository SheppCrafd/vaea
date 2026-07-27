import { describe, it, expect } from "vitest";
import { matchesProtocolTrigger } from "./protocolReminder.js";

describe("matchesProtocolTrigger", () => {
  it("matches the documented trigger words", () => {
    expect(matchesProtocolTrigger("there's a bug in the login flow")).toBe(true);
    expect(matchesProtocolTrigger("getting a weird error on save")).toBe(true);
    expect(matchesProtocolTrigger("what's the right architecture for this")).toBe(true);
    expect(matchesProtocolTrigger("which approach should I take here")).toBe(true);
  });

  it("matches common bug-report phrasing beyond the literal word list", () => {
    expect(matchesProtocolTrigger("the sync is broken again")).toBe(true);
    expect(matchesProtocolTrigger("it crashes when I click save")).toBe(true);
    expect(matchesProtocolTrigger("why isn't this updating")).toBe(true);
    expect(matchesProtocolTrigger("this feature is just not working")).toBe(true);
  });

  it("doesn't match ordinary requests with no bug/architecture shape", () => {
    expect(matchesProtocolTrigger("add a new area called Marketing")).toBe(false);
    expect(matchesProtocolTrigger("what tasks are due this week")).toBe(false);
  });

  it("handles empty/missing input", () => {
    expect(matchesProtocolTrigger("")).toBe(false);
    expect(matchesProtocolTrigger(undefined)).toBe(false);
    expect(matchesProtocolTrigger(null)).toBe(false);
  });
});
