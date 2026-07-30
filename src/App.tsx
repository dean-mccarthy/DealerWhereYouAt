import { useEffect, useMemo, useState } from "react";
import { ActionControls } from "./components/ActionControls";
import { BetControls } from "./components/BetControls";
import { TableView } from "./components/TableView";
import { TrainingPanel } from "./components/TrainingPanel";
import { fetchCardImageMap } from "./game/deckApi";
import { applyAction, legalActions, resolveOutcomes, startRound } from "./game/engine";
import { DEFAULT_RULES } from "./game/rules";
import { createShoe } from "./game/shoe";
import type { Card, PlayerAction, RoundState } from "./game/types";
import { recommendedActionFromBasicStrategy } from "./training/strategyTable";
import { getTrainingFeedback } from "./training/advisor";
import type { TrainingFeedback } from "./training/types";

const STARTING_CREDITS = 1000;

const ensureShoe = (shoe: Card[]): Card[] =>
  shoe.length < 30 ? createShoe(DEFAULT_RULES.deckCount) : shoe;

function App() {
  const [credits, setCredits] = useState(STARTING_CREDITS);
  const [bet, setBet] = useState(0);
  const [shoe, setShoe] = useState<Card[]>(() => createShoe(DEFAULT_RULES.deckCount));
  const [round, setRound] = useState<RoundState | null>(null);
  const [message, setMessage] = useState("Welcome to Blackjack Trainer.");
  const [trainingMode, setTrainingMode] = useState(true);
  const [feedbackHistory, setFeedbackHistory] = useState<TrainingFeedback[]>([]);
  const [cardImageMap, setCardImageMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetchCardImageMap()
      .then((nextCardImageMap) => {
        if (!cancelled) {
          setCardImageMap(nextCardImageMap);
        }
      })
      .catch(() => {
        // Keep text-only fallback if artwork fails to load.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const currentLegalActions = useMemo(
    () => (round ? legalActions(round, DEFAULT_RULES) : []),
    [round],
  );

  const recommendation = useMemo(() => {
    if (!trainingMode || !round || round.phase !== "playerTurn") return null;
    const hand = round.playerHands[round.activeHandIndex];
    return recommendedActionFromBasicStrategy(hand.cards, round.dealerHand[0], currentLegalActions);
  }, [currentLegalActions, round, trainingMode]);

  const validateBet = (candidateBet: number): string | null => {
    if (!Number.isFinite(candidateBet)) return "Enter a valid bet.";
    if (candidateBet < DEFAULT_RULES.minBet) return `Minimum bet is ${DEFAULT_RULES.minBet}.`;
    if (candidateBet % DEFAULT_RULES.betStep !== 0) {
      return `Bet must be in increments of ${DEFAULT_RULES.betStep}.`;
    }
    if (candidateBet > credits) return "Not enough credits.";
    return null;
  };

  const handleDeal = () => {
    if (round && round.phase !== "roundOver") {
      setMessage("Finish the current round first.");
      return;
    }
    const validationError = validateBet(bet);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    const replenishedShoe = ensureShoe(shoe);
    const started = startRound(replenishedShoe, bet);
    const startedRoundOutcomes =
      started.round.phase === "roundOver" ? resolveOutcomes(started.round, DEFAULT_RULES) : null;
    const immediateReturnedCredits =
      startedRoundOutcomes?.reduce((sum, entry) => sum + entry.returnedCredits, 0) ?? 0;
    setShoe(started.shoe);
    setRound(started.round);
    setCredits((value) => value - bet + immediateReturnedCredits);
    setFeedbackHistory([]);
    if (startedRoundOutcomes) {
      const outcomeText = startedRoundOutcomes
        .map((entry, index) => `Hand ${index + 1}: ${entry.result} (+${entry.returnedCredits})`)
        .join(" | ");
      setMessage(`Round complete. ${outcomeText}`);
    } else {
      setMessage("Round started.");
    }
  };

  const handleAction = (action: PlayerAction) => {
    if (!round) return;
    if (round.phase !== "playerTurn") return;

    const hand = round.playerHands[round.activeHandIndex];
    if (trainingMode) {
      const feedback = getTrainingFeedback(
        {
          playerCards: hand.cards,
          dealerUpCard: round.dealerHand[0],
          allowedActions: currentLegalActions,
          isSplitHand: hand.isSplitHand,
        },
        action,
      );
      setFeedbackHistory((value) => [...value, feedback]);
    }

    const applied = applyAction(round, shoe, action, DEFAULT_RULES);
    if (applied.result.additionalWager > credits) {
      setMessage("Not enough credits for that action.");
      return;
    }
    setCredits((value) => value - applied.result.additionalWager);
    setRound(applied.result.round);
    setShoe(applied.shoe);
    setMessage(applied.result.feedbackMessage);

    if (applied.result.round.phase === "roundOver") {
      const outcomes = resolveOutcomes(applied.result.round, DEFAULT_RULES);
      const returnedCredits = outcomes.reduce((sum, entry) => sum + entry.returnedCredits, 0);
      setCredits((value) => value + returnedCredits);
      const outcomeText = outcomes
        .map((entry, index) => `Hand ${index + 1}: ${entry.result} (+${entry.returnedCredits})`)
        .join(" | ");
      setMessage(`Round complete. ${outcomeText}`);
    }
  };

  return (
    <main className="app">
      <h1>Blackjack Simulator</h1>
      <p>{message}</p>
      <div className="layout">
        <div className="table-zone">
          <TableView round={round} cardImageMap={cardImageMap} />
        </div>
        <div className="middle-zone">
          <ActionControls
            legalActions={currentLegalActions}
            onAction={handleAction}
            disabled={!round || round.phase !== "playerTurn"}
          />
          <TrainingPanel
            trainingMode={trainingMode}
            onToggleTrainingMode={setTrainingMode}
            currentRecommendation={recommendation}
            feedbackHistory={feedbackHistory}
          />
        </div>
        <div className="chips-zone">
          <BetControls
            credits={credits}
            bet={bet}
            minBet={DEFAULT_RULES.minBet}
            onBetChange={setBet}
            onDeal={handleDeal}
            disabled={round !== null && round.phase !== "roundOver"}
          />
        </div>
      </div>
    </main>
  );
}

export default App;
