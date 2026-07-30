import type { Card, Rank, Suit } from "./types";

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export const buildDeck = (): Card[] => {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ suit, rank });
    }
  }
  return cards;
};

export const cardNumericValue = (card: Card): number => {
  if (card.rank === "A") return 11;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  return Number(card.rank);
};

export const cardCode = (card: Card): string => {
  const rankCode = card.rank === "10" ? "0" : card.rank;
  const suitCodeMap: Record<Suit, string> = {
    spades: "S",
    hearts: "H",
    diamonds: "D",
    clubs: "C",
  };
  return `${rankCode}${suitCodeMap[card.suit]}`;
};
