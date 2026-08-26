import { describe, expect, it } from "vitest";
import { resolvePairSideBet, resolvePotOfGoldSideBet } from "./sideBet";
import type { Card } from "./types";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

describe("pair side bet", () => {
  it("returns null when no side bet is placed", () => {
    expect(resolvePairSideBet([c("A", "spades"), c("K", "hearts")], 0)).toBeNull();
  });

  it("loses on non-pair", () => {
    const outcome = resolvePairSideBet([c("A", "spades"), c("K", "spades")], 10);
    expect(outcome?.won).toBe(false);
    expect(outcome?.returnedCredits).toBe(0);
    expect(outcome?.payoutLabel).toBe("No Pair");
  });

  it("pays perfect pair at 30:1 plus original bet", () => {
    const outcome = resolvePairSideBet([c("9", "spades"), c("9", "spades")], 10);
    expect(outcome?.won).toBe(true);
    expect(outcome?.returnedCredits).toBe(310);
    expect(outcome?.payoutLabel).toBe("Perfect Pair (30:1)");
  });

  it("pays colored pair at 15:1 plus original bet", () => {
    const outcome = resolvePairSideBet([c("Q", "hearts"), c("Q", "diamonds")], 10);
    expect(outcome?.won).toBe(true);
    expect(outcome?.returnedCredits).toBe(160);
    expect(outcome?.payoutLabel).toBe("Colored Pair (15:1)");
  });

  it("pays mixed pair at 7:1 plus original bet", () => {
    const outcome = resolvePairSideBet([c("5", "hearts"), c("5", "clubs")], 10);
    expect(outcome?.won).toBe(true);
    expect(outcome?.returnedCredits).toBe(80);
    expect(outcome?.payoutLabel).toBe("Mixed Pair (7:1)");
  });
});

describe("pot of gold side bet", () => {
  it("returns null when wager is zero", () => {
    expect(resolvePotOfGoldSideBet(3, 0)).toBeNull();
  });

  it("loses with no tokens", () => {
    const outcome = resolvePotOfGoldSideBet(0, 10);
    expect(outcome?.won).toBe(false);
    expect(outcome?.returnedCredits).toBe(0);
    expect(outcome?.payoutLabel).toBe("No Tokens");
  });

  it("pays 3:1 for one token", () => {
    const outcome = resolvePotOfGoldSideBet(1, 10);
    expect(outcome?.won).toBe(true);
    expect(outcome?.returnedCredits).toBe(40);
    expect(outcome?.payoutLabel).toBe("1 Token (3:1)");
  });

  it("pays 1000:1 for seven or more tokens", () => {
    const outcome = resolvePotOfGoldSideBet(9, 10);
    expect(outcome?.won).toBe(true);
    expect(outcome?.returnedCredits).toBe(10010);
    expect(outcome?.payoutLabel).toBe("7 Tokens (1000:1)");
  });
});
