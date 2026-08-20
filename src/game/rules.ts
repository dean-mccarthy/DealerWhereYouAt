import type { Rules } from "./types";

export const DEFAULT_RULES: Rules = {
  deckCount: 2,
  dealerHitsSoft17: false,
  blackjackPayout: 1.5,
  doubleAfterSplit: true,
  gameMode: "classic",
  minBet: 5,
  betStep: 5,
};

export const FREE_BET_RULES: Rules = {
  deckCount: 2,
  dealerHitsSoft17: false,
  blackjackPayout: 1.5,
  doubleAfterSplit: true,
  gameMode: "freeBet",
  minBet: 5,
  betStep: 5,
};
