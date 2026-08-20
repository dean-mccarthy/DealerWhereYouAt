import type { Card, PlayerAction } from "../game/types";

export interface StrategyContext {
  playerCards: Card[];
  dealerUpCard: Card;
  allowedActions: PlayerAction[];
  isSplitHand: boolean;
  gameMode: "classic" | "freeBet";
  isFreeBetHand: boolean;
}

export interface TrainingFeedback {
  chosenAction: PlayerAction;
  recommendedAction: PlayerAction;
  isCorrect: boolean;
  explanation: string;
}
