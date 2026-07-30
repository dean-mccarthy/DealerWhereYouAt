import { afterEach, describe, expect, it, vi } from "vitest";
import { advanceDealerTurn, applyAction, resolveOutcomes, startRound } from "./engine";
import { DEFAULT_RULES } from "./rules";
import type { Card, RoundState } from "./types";

const c = (rank: Card["rank"], suit: Card["suit"] = "spades"): Card => ({ rank, suit });

describe("engine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles split with extra wager", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const round: RoundState = {
      phase: "playerTurn",
      playerHands: [
        {
          id: "h1",
          cards: [c("8"), c("8", "hearts")],
          bet: 25,
          stood: false,
          doubled: false,
          isSplitHand: false,
        },
      ],
      dealerHand: [c("6"), c("10")],
      activeHandIndex: 0,
      message: "",
    };
    const shoe = [c("2"), c("3"), c("9"), c("4")];
    const applied = applyAction(round, shoe, "split", DEFAULT_RULES);
    expect(applied.result.additionalWager).toBe(25);
    expect(applied.result.round.playerHands).toHaveLength(2);
  });

  it("allows split on mixed ten-value cards", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const round: RoundState = {
      phase: "playerTurn",
      playerHands: [
        {
          id: "h1",
          cards: [c("10"), c("K", "hearts")],
          bet: 25,
          stood: false,
          doubled: false,
          isSplitHand: false,
        },
      ],
      dealerHand: [c("6"), c("9")],
      activeHandIndex: 0,
      message: "",
    };
    const shoe = [c("2"), c("3"), c("9"), c("4")];
    const applied = applyAction(round, shoe, "split", DEFAULT_RULES);
    expect(applied.result.feedbackMessage).toBe("You split");
    expect(applied.result.round.playerHands).toHaveLength(2);
    expect(applied.result.additionalWager).toBe(25);
  });

  it("pays blackjack at 3:2", () => {
    const round: RoundState = {
      phase: "roundOver",
      playerHands: [
        {
          id: "h1",
          cards: [c("A"), c("K")],
          bet: 20,
          stood: true,
          doubled: false,
          isSplitHand: false,
        },
      ],
      dealerHand: [c("9"), c("7"), c("3")],
      activeHandIndex: 0,
      message: "",
    };
    const outcomes = resolveOutcomes(round, DEFAULT_RULES);
    expect(outcomes[0].result).toBe("blackjack");
    expect(outcomes[0].returnedCredits).toBe(50);
  });

  it("ends the round immediately when dealer has blackjack", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const shoe = [c("9"), c("7"), c("A"), c("K")];
    const started = startRound(shoe, 25);

    expect(started.round.phase).toBe("roundOver");
    expect(started.round.message).toBe("Dealer has blackjack");
  });

  it("enters dealer turn after final player stand", () => {
    const round: RoundState = {
      phase: "playerTurn",
      playerHands: [
        {
          id: "h1",
          cards: [c("10"), c("7")],
          bet: 25,
          stood: false,
          doubled: false,
          isSplitHand: false,
        },
      ],
      dealerHand: [c("6"), c("10")],
      activeHandIndex: 0,
      message: "",
    };
    const applied = applyAction(round, [], "stand", DEFAULT_RULES);
    expect(applied.result.round.phase).toBe("dealerTurn");
    expect(applied.result.round.message).toBe("Dealer reveals hole card");
  });

  it("advances dealer one card at a time", () => {
    const round: RoundState = {
      phase: "dealerTurn",
      playerHands: [
        {
          id: "h1",
          cards: [c("10"), c("7")],
          bet: 25,
          stood: true,
          doubled: false,
          isSplitHand: false,
        },
      ],
      dealerHand: [c("6"), c("9")],
      activeHandIndex: 0,
      message: "",
    };
    const advanced = advanceDealerTurn(round, [c("2")], DEFAULT_RULES);
    expect(advanced.round.phase).toBe("dealerTurn");
    expect(advanced.round.dealerHand).toHaveLength(3);
    expect(advanced.round.message).toBe("Dealer hits");

    const finished = advanceDealerTurn(advanced.round, advanced.shoe, DEFAULT_RULES);
    expect(finished.round.phase).toBe("roundOver");
  });
});
