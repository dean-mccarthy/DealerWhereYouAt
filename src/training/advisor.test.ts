import { describe, expect, it } from "vitest";
import { getTrainingFeedback } from "./advisor";
import type { Card } from "../game/types";

const c = (rank: Card["rank"], suit: Card["suit"] = "spades"): Card => ({ rank, suit });

describe("training advisor", () => {
  it("recommends split aces", () => {
    const feedback = getTrainingFeedback(
      {
        playerCards: [c("A"), c("A", "hearts")],
        dealerUpCard: c("6"),
        allowedActions: ["hit", "stand", "split"],
        isSplitHand: false,
      },
      "split",
    );
    expect(feedback.isCorrect).toBe(true);
  });

  it("flags incorrect hard total play", () => {
    const feedback = getTrainingFeedback(
      {
        playerCards: [c("10"), c("2", "hearts")],
        dealerUpCard: c("4"),
        allowedActions: ["hit", "stand"],
        isSplitHand: false,
      },
      "hit",
    );
    expect(feedback.isCorrect).toBe(false);
    expect(feedback.recommendedAction).toBe("stand");
  });

  it("treats pair fives as hard ten (double vs dealer 6)", () => {
    const feedback = getTrainingFeedback(
      {
        playerCards: [c("5"), c("5", "hearts")],
        dealerUpCard: c("6"),
        allowedActions: ["hit", "stand", "double", "split"],
        isSplitHand: false,
      },
      "double",
    );
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.recommendedAction).toBe("double");
  });

  it("treats pair fives as hard ten (hit vs dealer ace)", () => {
    const feedback = getTrainingFeedback(
      {
        playerCards: [c("5"), c("5", "hearts")],
        dealerUpCard: c("A"),
        allowedActions: ["hit", "stand", "double", "split"],
        isSplitHand: false,
      },
      "hit",
    );
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.recommendedAction).toBe("hit");
  });
});
