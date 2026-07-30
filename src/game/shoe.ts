import { buildDeck } from "./cards";
import type { Card } from "./types";

const shuffle = (cards: Card[]): Card[] => {
  const cloned = [...cards];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
};

export const createShoe = (deckCount: number): Card[] => {
  const cards: Card[] = [];
  for (let i = 0; i < deckCount; i += 1) {
    cards.push(...buildDeck());
  }
  return shuffle(cards);
};

export const draw = (shoe: Card[]): { card: Card; shoe: Card[] } => {
  if (!shoe.length) {
    throw new Error("Shoe is empty");
  }
  const drawIndex = Math.floor(Math.random() * shoe.length);
  const card = shoe[drawIndex];
  const nextShoe = shoe.filter((_, index) => index !== drawIndex);
  return { card, shoe: nextShoe };
};
