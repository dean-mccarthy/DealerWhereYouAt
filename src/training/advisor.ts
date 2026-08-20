import type { PlayerAction } from "../game/types";
import { recommendedActionFromBasicStrategy } from "./strategyTable";
import type { StrategyContext, TrainingFeedback } from "./types";

const actionLabel = (action: PlayerAction): string => {
  if (action === "hit") return "Hit";
  if (action === "stand") return "Stand";
  if (action === "double") return "Double";
  return "Split";
};

export const getTrainingFeedback = (
  context: StrategyContext,
  chosenAction: PlayerAction,
): TrainingFeedback => {
  const recommendedAction = recommendedActionFromBasicStrategy(
    context.playerCards,
    context.dealerUpCard,
    context.allowedActions,
    context.gameMode,
    context.isFreeBetHand,
  );
  const isCorrect = chosenAction === recommendedAction;
  const chosenLabel = actionLabel(chosenAction);
  const recommendedLabel = actionLabel(recommendedAction);
  const explanation = isCorrect
    ? `${chosenLabel}: correct`
    : `${chosenLabel}: incorrect, recommended: ${recommendedLabel}`;

  return {
    chosenAction,
    recommendedAction,
    isCorrect,
    explanation,
  };
};
