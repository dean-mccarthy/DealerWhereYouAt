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
        gameMode: "classic",
        isFreeBetHand: false,
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
        gameMode: "classic",
        isFreeBetHand: false,
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
        gameMode: "classic",
        isFreeBetHand: false,
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
        gameMode: "classic",
        isFreeBetHand: false,
      },
      "hit",
    );
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.recommendedAction).toBe("hit");
  });

  it("uses free-bet real-money chart for hard 14 vs dealer 2", () => {
    const feedback = getTrainingFeedback(
      {
        playerCards: [c("9"), c("5", "hearts")],
        dealerUpCard: c("2"),
        allowedActions: ["hit", "stand"],
        isSplitHand: false,
        gameMode: "freeBet",
        isFreeBetHand: false,
      },
      "stand",
    );
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.recommendedAction).toBe("stand");
  });

  it("uses free-bet free-hand chart for hard 14 vs dealer 2", () => {
    const feedback = getTrainingFeedback(
      {
        playerCards: [c("9"), c("5", "hearts")],
        dealerUpCard: c("2"),
        allowedActions: ["hit", "stand"],
        isSplitHand: true,
        gameMode: "freeBet",
        isFreeBetHand: true,
      },
      "hit",
    );
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.recommendedAction).toBe("hit");
  });

  it("uses free-bet split chart to split nines", () => {
    const feedback = getTrainingFeedback(
      {
        playerCards: [c("9"), c("9", "hearts")],
        dealerUpCard: c("10"),
        allowedActions: ["hit", "stand", "split"],
        isSplitHand: false,
        gameMode: "freeBet",
        isFreeBetHand: false,
      },
      "split",
    );
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.recommendedAction).toBe("split");
  });

  it("uses hard 15 vs 10 fallback from S+ to hit", () => {
    const feedback = getTrainingFeedback(
      {
        playerCards: [c("9"), c("6", "hearts")],
        dealerUpCard: c("10"),
        allowedActions: ["hit", "stand"],
        isSplitHand: false,
        gameMode: "freeBet",
        isFreeBetHand: false,
      },
      "hit",
    );
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.recommendedAction).toBe("hit");
  });

  it("uses hard 17 vs ace fallback from S- to stand", () => {
    const feedback = getTrainingFeedback(
      {
        playerCards: [c("10"), c("7", "hearts")],
        dealerUpCard: c("A"),
        allowedActions: ["hit", "stand"],
        isSplitHand: false,
        gameMode: "freeBet",
        isFreeBetHand: false,
      },
      "stand",
    );
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.recommendedAction).toBe("stand");
  });

  it("uses hard 16 vs 9 fallback from R to hit", () => {
    const feedback = getTrainingFeedback(
      {
        playerCards: [c("10"), c("6", "hearts")],
        dealerUpCard: c("9"),
        allowedActions: ["hit", "stand"],
        isSplitHand: false,
        gameMode: "freeBet",
        isFreeBetHand: false,
      },
      "hit",
    );
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.recommendedAction).toBe("hit");
  });

  it("uses free-bet split chart row for pair fives as free double", () => {
    const feedback = getTrainingFeedback(
      {
        playerCards: [c("5"), c("5", "hearts")],
        dealerUpCard: c("A"),
        allowedActions: ["hit", "stand", "double", "split"],
        isSplitHand: false,
        gameMode: "freeBet",
        isFreeBetHand: false,
      },
      "double",
    );
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.recommendedAction).toBe("double");
  });

  it("uses free-bet split chart row for pair tens as stand", () => {
    const feedback = getTrainingFeedback(
      {
        playerCards: [c("10"), c("10", "hearts")],
        dealerUpCard: c("6"),
        allowedActions: ["hit", "stand", "split"],
        isSplitHand: false,
        gameMode: "freeBet",
        isFreeBetHand: false,
      },
      "stand",
    );
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.recommendedAction).toBe("stand");
  });

  it("treats face-card pairs as tens row in free-bet splits chart", () => {
    const feedback = getTrainingFeedback(
      {
        playerCards: [c("K"), c("K", "hearts")],
        dealerUpCard: c("7"),
        allowedActions: ["hit", "stand", "split"],
        isSplitHand: false,
        gameMode: "freeBet",
        isFreeBetHand: false,
      },
      "stand",
    );
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.recommendedAction).toBe("stand");
  });
});
