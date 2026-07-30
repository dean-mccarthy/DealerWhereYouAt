import { evaluateHand } from "../game/hand";
import type { Card, PlayerAction } from "../game/types";

const upcardValue = (card: Card): number => {
  if (card.rank === "A") return 11;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  return Number(card.rank);
};

const fallbackByAllowed = (allowed: PlayerAction[], preferred: PlayerAction): PlayerAction => {
  if (allowed.includes(preferred)) return preferred;
  if (preferred === "split" && allowed.includes("hit")) return "hit";
  if (preferred === "double" && allowed.includes("hit")) return "hit";
  if (allowed.includes("stand")) return "stand";
  return allowed[0];
};

const splitDecision = (rank: string, dealer: number): PlayerAction => {
  if (rank === "A" || rank === "8") return "split";
  if (rank === "10" || rank === "5") return "stand";
  if (rank === "9") return [2, 3, 4, 5, 6, 8, 9].includes(dealer) ? "split" : "stand";
  if (rank === "7") return dealer <= 7 ? "split" : "hit";
  if (rank === "6") return dealer >= 2 && dealer <= 6 ? "split" : "hit";
  if (rank === "4") return dealer === 5 || dealer === 6 ? "split" : "hit";
  if (rank === "3" || rank === "2") return dealer >= 2 && dealer <= 7 ? "split" : "hit";
  return "stand";
};

const softDecision = (total: number, dealer: number): PlayerAction => {
  if (total >= 20) return "stand";
  if (total === 19) return dealer === 6 ? "double" : "stand";
  if (total === 18) {
    if ([3, 4, 5, 6].includes(dealer)) return "double";
    if ([2, 7, 8].includes(dealer)) return "stand";
    return "hit";
  }
  if (total === 17) return dealer >= 3 && dealer <= 6 ? "double" : "hit";
  if (total === 16 || total === 15) return dealer >= 4 && dealer <= 6 ? "double" : "hit";
  if (total === 14 || total === 13) return dealer >= 5 && dealer <= 6 ? "double" : "hit";
  return "hit";
};

const hardDecision = (total: number, dealer: number): PlayerAction => {
  if (total >= 17) return "stand";
  if (total >= 13 && total <= 16) return dealer >= 2 && dealer <= 6 ? "stand" : "hit";
  if (total === 12) return dealer >= 4 && dealer <= 6 ? "stand" : "hit";
  if (total === 11) return "double";
  if (total === 10) return dealer <= 9 ? "double" : "hit";
  if (total === 9) return dealer >= 3 && dealer <= 6 ? "double" : "hit";
  return "hit";
};

export const recommendedActionFromBasicStrategy = (
  cards: Card[],
  dealerUpCard: Card,
  allowedActions: PlayerAction[],
): PlayerAction => {
  const dealer = upcardValue(dealerUpCard);
  const isPair = cards.length === 2 && cards[0].rank === cards[1].rank;
  const pairRank = isPair ? cards[0].rank : null;
  // 5,5 and 10,10 are "never split" rows; play them as hard totals instead.
  const shouldUsePairTable = isPair && pairRank !== "5" && pairRank !== "10";
  if (allowedActions.includes("split") && shouldUsePairTable) {
    const pref = splitDecision(cards[0].rank, dealer);
    return fallbackByAllowed(allowedActions, pref);
  }

  const value = evaluateHand(cards);
  const pref = value.isSoft ? softDecision(value.total, dealer) : hardDecision(value.total, dealer);
  return fallbackByAllowed(allowedActions, pref);
};
