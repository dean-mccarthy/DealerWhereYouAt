export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type PlayerAction = "hit" | "stand" | "double" | "split";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface Rules {
  deckCount: number;
  dealerHitsSoft17: boolean;
  blackjackPayout: number;
  doubleAfterSplit: boolean;
  gameMode: "classic" | "freeBet";
  minBet: number;
  betStep: number;
}

export interface HandState {
  id: string;
  cards: Card[];
  bet: number;
  freeBetPortion: number;
  stood: boolean;
  doubled: boolean;
  isSplitHand: boolean;
}

export interface RoundState {
  phase: "betting" | "playerTurn" | "dealerTurn" | "roundOver";
  playerHands: HandState[];
  dealerHand: Card[];
  activeHandIndex: number;
  message: string;
}

export interface HandValue {
  total: number;
  isSoft: boolean;
  isBlackjack: boolean;
  isBust: boolean;
}

export interface HandOutcome {
  handId: string;
  result: "win" | "loss" | "push" | "blackjack";
  returnedCredits: number;
}

export interface ActionResult {
  round: RoundState;
  additionalWager: number;
  feedbackMessage: string;
}
