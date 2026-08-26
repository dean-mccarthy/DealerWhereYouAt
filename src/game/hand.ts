import { cardNumericValue } from "./cards";
import type { Card, HandState, HandValue } from "./types";

export const evaluateHand = (cards: Card[]): HandValue => {
  let total = cards.reduce((acc, card) => acc + cardNumericValue(card), 0);
  const aceCount = cards.filter((card) => card.rank === "A").length;

  let adjustedAces = aceCount;
  while (total > 21 && adjustedAces > 0) {
    total -= 10;
    adjustedAces -= 1;
  }

  const isSoft = aceCount > 0 && adjustedAces > 0;
  const isBlackjack = cards.length === 2 && total === 21;
  return {
    total,
    isSoft,
    isBlackjack,
    isBust: total > 21,
  };
};

export const isSplitAceHand = (hand: HandState): boolean =>
  hand.isSplitHand && hand.cards[0]?.rank === "A";

export const canSplit = (hand: HandState): boolean => {
  if (hand.cards.length !== 2) return false;
  if (isSplitAceHand(hand)) return false;
  const [firstCard, secondCard] = hand.cards;
  if (firstCard.rank === secondCard.rank) return true;
  return cardNumericValue(firstCard) === 10 && cardNumericValue(secondCard) === 10;
};

export const handLabel = (cards: Card[]): string =>
  cards.map((card) => `${card.rank}${card.suit[0].toUpperCase()}`).join(" ");
