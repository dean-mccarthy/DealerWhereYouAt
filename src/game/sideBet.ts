import type { Card } from "./types";

export interface SideBetOutcome {
  name: string;
  wager: number;
  won: boolean;
  returnedCredits: number;
  payoutLabel: string;
}

const isRedSuit = (suit: Card["suit"]): boolean => suit === "hearts" || suit === "diamonds";

const POT_OF_GOLD_TABLE_ONE: Record<number, number> = {
  1: 3,
  2: 10,
  3: 30,
  4: 60,
  5: 100,
  6: 300,
  7: 1000,
};

export const resolvePairSideBet = (cards: Card[], wager: number, name = "Perfect Pair"): SideBetOutcome | null => {
  if (wager <= 0) return null;
  const [firstCard, secondCard] = cards;
  if (!firstCard || !secondCard) {
    return {
      name,
      wager,
      won: false,
      returnedCredits: 0,
      payoutLabel: "No Pair",
    };
  }

  if (firstCard.rank !== secondCard.rank) {
    return {
      name,
      wager,
      won: false,
      returnedCredits: 0,
      payoutLabel: "No Pair",
    };
  }

  const sameSuit = firstCard.suit === secondCard.suit;
  if (sameSuit) {
    return {
      name,
      wager,
      won: true,
      returnedCredits: wager * 31,
      payoutLabel: "Perfect Pair (30:1)",
    };
  }

  const sameColor = isRedSuit(firstCard.suit) === isRedSuit(secondCard.suit);
  if (sameColor) {
    return {
      name,
      wager,
      won: true,
      returnedCredits: wager * 16,
      payoutLabel: "Colored Pair (15:1)",
    };
  }

  return {
    name,
    wager,
    won: true,
    returnedCredits: wager * 8,
    payoutLabel: "Mixed Pair (7:1)",
  };
};

export const resolvePotOfGoldSideBet = (lammersCollected: number, wager: number, name = "Pot of Gold"): SideBetOutcome | null => {
  if (wager <= 0) return null;
  const clampedLammers = Math.max(0, Math.floor(lammersCollected));
  const lookupLammers = Math.min(7, clampedLammers);
  const payoutOdds = POT_OF_GOLD_TABLE_ONE[lookupLammers];

  if (!payoutOdds) {
    return {
      name,
      wager,
      won: false,
      returnedCredits: 0,
      payoutLabel: "No Tokens",
    };
  }

  return {
    name,
    wager,
    won: true,
    returnedCredits: wager * (1 + payoutOdds),
    payoutLabel: `${lookupLammers} Token${lookupLammers === 1 ? "" : "s"} (${payoutOdds}:1)`,
  };
};
