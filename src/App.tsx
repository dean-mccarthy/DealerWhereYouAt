import { useEffect, useMemo, useRef, useState } from "react";
import { ActionControls } from "./components/ActionControls";
import { BetControls } from "./components/BetControls";
import { TableView } from "./components/TableView";
import { TrainingPanel } from "./components/TrainingPanel";
import { fetchCardImageMap } from "./game/deckApi";
import { advanceDealerTurn, applyAction, legalActions, resolveOutcomes, startRound } from "./game/engine";
import { DEFAULT_RULES } from "./game/rules";
import { createShoe, draw } from "./game/shoe";
import type { Card, PlayerAction, RoundState } from "./game/types";
import { recommendedActionFromBasicStrategy } from "./training/strategyTable";
import { getTrainingFeedback } from "./training/advisor";
import type { TrainingFeedback } from "./training/types";

const STARTING_CREDITS = 1000;
const SHOE_RESHUFFLE_PENETRATION = 0.5;
const INITIAL_SHOE_SIZE = DEFAULT_RULES.deckCount * 52;

const ensureShoe = (shoe: Card[]): Card[] =>
  shoe.length <= Math.floor(INITIAL_SHOE_SIZE * SHOE_RESHUFFLE_PENETRATION)
    ? createShoe(DEFAULT_RULES.deckCount)
    : shoe;
const DEALER_REVEAL_DELAY_MS = 900;
const DEALER_STEP_DELAY_MS = 1000;
const SPLIT_STEP_DELAY_MS = 620;
const SHUFFLE_ANIMATION_MS = 1300;
const INITIAL_DEAL_CARD_ANIMATION_MS = 520;
const DRAW_CARD_ANIMATION_MS = 360;
const DRAW_ANIMATION_BUFFER_MS = 70;
const HOLE_REVEAL_START_DELAY_MS = 350;
const HOLE_REVEAL_ANIMATION_MS = 300;
const HOLE_REVEAL_AFTER_BUST_DRAW_DELAY_MS = 460;
const MOVE_RESULT_POPUP_MS = 950;
const DEAL_CARD_STAGGER_MS = 120;
const INITIAL_DEAL_CARD_COUNT = 4;
const DEAL_ANIMATION_MS =
  INITIAL_DEAL_CARD_ANIMATION_MS + DEAL_CARD_STAGGER_MS * (INITIAL_DEAL_CARD_COUNT - 1) + 120;
const DRAW_ANIMATION_MS = DRAW_CARD_ANIMATION_MS + DRAW_ANIMATION_BUFFER_MS;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function App() {
  const [credits, setCredits] = useState(STARTING_CREDITS);
  const [bet, setBet] = useState(0);
  const [shoe, setShoe] = useState<Card[]>(() => createShoe(DEFAULT_RULES.deckCount));
  const [round, setRound] = useState<RoundState | null>(null);
  const [message, setMessage] = useState("Welcome to Blackjack Trainer.");
  const [trainingMode, setTrainingMode] = useState(true);
  const [feedbackHistory, setFeedbackHistory] = useState<TrainingFeedback[]>([]);
  const [lastRecommendation, setLastRecommendation] = useState<PlayerAction | null>(null);
  const [cardImageMap, setCardImageMap] = useState<Record<string, string>>({});
  const [splitAnimating, setSplitAnimating] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [dealAnimationActive, setDealAnimationActive] = useState(false);
  const [dealAnimationTick, setDealAnimationTick] = useState(0);
  const [dealAnimationTargets, setDealAnimationTargets] = useState<string[] | null>(null);
  const [dealAnimationDurationMs, setDealAnimationDurationMs] = useState(INITIAL_DEAL_CARD_ANIMATION_MS);
  const [holeRevealActive, setHoleRevealActive] = useState(false);
  const [holeRevealTick, setHoleRevealTick] = useState(0);
  const [holeCardRevealed, setHoleCardRevealed] = useState(false);
  const [moveResultIndicator, setMoveResultIndicator] = useState<{ isCorrect: boolean; tick: number } | null>(
    null,
  );
  const dealerAnimationRunningRef = useRef(false);
  const dealerRevealDelayMsRef = useRef(DEALER_REVEAL_DELAY_MS);
  const holeRevealStartDelayMsRef = useRef(HOLE_REVEAL_START_DELAY_MS);
  const shuffleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holeRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holeRevealStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousRoundPhaseRef = useRef<RoundState["phase"] | null>(null);

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

  useEffect(
    () => () => {
      if (shuffleTimeoutRef.current) clearTimeout(shuffleTimeoutRef.current);
      if (dealTimeoutRef.current) clearTimeout(dealTimeoutRef.current);
      if (holeRevealTimeoutRef.current) clearTimeout(holeRevealTimeoutRef.current);
      if (holeRevealStartTimeoutRef.current) clearTimeout(holeRevealStartTimeoutRef.current);
      if (moveResultTimeoutRef.current) clearTimeout(moveResultTimeoutRef.current);
    },
    [],
  );

  const currentLegalActions = useMemo(
    () => (round ? legalActions(round, DEFAULT_RULES) : []),
    [round],
  );
  const cannotAffordDouble = useMemo(() => {
    if (!round || round.phase !== "playerTurn") return false;
    const activeHand = round.playerHands[round.activeHandIndex];
    return activeHand.bet > credits;
  }, [credits, round]);
  const dealDisabled =
    (round !== null && round.phase !== "roundOver") || bet < DEFAULT_RULES.minBet || splitAnimating;

  const recommendation = useMemo(() => {
    if (!round || round.phase !== "playerTurn") return null;
    const hand = round.playerHands[round.activeHandIndex];
    return recommendedActionFromBasicStrategy(hand.cards, round.dealerHand[0], currentLegalActions);
  }, [currentLegalActions, round]);

  useEffect(() => {
    if (recommendation) setLastRecommendation(recommendation);
  }, [recommendation]);

  useEffect(() => {
    const nextPhase = round?.phase ?? null;
    const previousPhase = previousRoundPhaseRef.current;
    const enteringDealerTurn = previousPhase === "playerTurn" && nextPhase === "dealerTurn";
    if (enteringDealerTurn) {
      setHoleCardRevealed(false);
      const revealStartDelay = holeRevealStartDelayMsRef.current;
      holeRevealStartDelayMsRef.current = HOLE_REVEAL_START_DELAY_MS;
      if (holeRevealStartTimeoutRef.current) clearTimeout(holeRevealStartTimeoutRef.current);
      if (holeRevealTimeoutRef.current) clearTimeout(holeRevealTimeoutRef.current);
      holeRevealStartTimeoutRef.current = setTimeout(() => {
        setHoleCardRevealed(true);
        setHoleRevealActive(true);
        setHoleRevealTick((value) => value + 1);
        holeRevealTimeoutRef.current = setTimeout(() => {
          setHoleRevealActive(false);
        }, HOLE_REVEAL_ANIMATION_MS);
      }, revealStartDelay);
    }
    previousRoundPhaseRef.current = nextPhase;
  }, [round?.phase]);

  useEffect(() => {
    if (!round || round.phase !== "dealerTurn" || dealerAnimationRunningRef.current) return;
    dealerAnimationRunningRef.current = true;
    let cancelled = false;

    const playDealerWithDelay = async () => {
      let animatedRound = round;
      let animatedShoe = shoe;
      const revealDelayMs = dealerRevealDelayMsRef.current;
      dealerRevealDelayMsRef.current = DEALER_REVEAL_DELAY_MS;
      await pause(revealDelayMs);

      while (!cancelled && animatedRound.phase === "dealerTurn") {
        const dealerCardCountBefore = animatedRound.dealerHand.length;
        const advanced = advanceDealerTurn(animatedRound, animatedShoe, DEFAULT_RULES);
        animatedRound = advanced.round;
        animatedShoe = advanced.shoe;
        if (animatedRound.dealerHand.length > dealerCardCountBefore) {
          const newestDealerCardIndex = animatedRound.dealerHand.length - 1;
          triggerDealAnimation([`dealer-${newestDealerCardIndex}`], DRAW_ANIMATION_MS, DRAW_CARD_ANIMATION_MS);
        }
        setRound(animatedRound);
        setShoe(animatedShoe);

        if (animatedRound.phase === "roundOver") {
          const outcomes = resolveOutcomes(animatedRound, DEFAULT_RULES);
          const returnedCredits = outcomes.reduce((sum, entry) => sum + entry.returnedCredits, 0);
          setCredits((value) => value + returnedCredits);
          const outcomeText = outcomes
            .map((entry, index) => `Hand ${index + 1}: ${entry.result} (+${entry.returnedCredits})`)
            .join(" | ");
          setMessage(`Round complete. ${outcomeText}`);
          break;
        }

        await pause(DEALER_STEP_DELAY_MS);
      }

      dealerAnimationRunningRef.current = false;
    };

    void playDealerWithDelay();
    return () => {
      cancelled = true;
      dealerAnimationRunningRef.current = false;
    };
  }, [round?.phase]);

  const validateBet = (candidateBet: number): string | null => {
    if (!Number.isFinite(candidateBet)) return "Enter a valid bet.";
    if (candidateBet < DEFAULT_RULES.minBet) return `Minimum bet is ${DEFAULT_RULES.minBet}.`;
    if (candidateBet % DEFAULT_RULES.betStep !== 0) {
      return `Bet must be in increments of ${DEFAULT_RULES.betStep}.`;
    }
    if (candidateBet > credits) return "Not enough credits.";
    return null;
  };

  const triggerDealAnimation = (
    targets: string[] | null,
    durationMs: number,
    cardAnimationDurationMs: number,
  ) => {
    setDealAnimationTargets(targets);
    setDealAnimationDurationMs(cardAnimationDurationMs);
    setDealAnimationActive(true);
    setDealAnimationTick((value) => value + 1);
    if (dealTimeoutRef.current) clearTimeout(dealTimeoutRef.current);
    dealTimeoutRef.current = setTimeout(() => {
      setDealAnimationActive(false);
      setDealAnimationTargets(null);
    }, durationMs);
  };

  const showMoveResultIndicator = (isCorrect: boolean) => {
    setMoveResultIndicator({ isCorrect, tick: Date.now() });
    if (moveResultTimeoutRef.current) clearTimeout(moveResultTimeoutRef.current);
    moveResultTimeoutRef.current = setTimeout(() => {
      setMoveResultIndicator(null);
    }, MOVE_RESULT_POPUP_MS);
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
    const didReshuffle = replenishedShoe !== shoe;
    if (didReshuffle) {
      setIsShuffling(true);
      if (shuffleTimeoutRef.current) clearTimeout(shuffleTimeoutRef.current);
      shuffleTimeoutRef.current = setTimeout(() => {
        setIsShuffling(false);
      }, SHUFFLE_ANIMATION_MS);
    }
    const started = startRound(replenishedShoe, bet);
    const startedRoundOutcomes =
      started.round.phase === "roundOver" ? resolveOutcomes(started.round, DEFAULT_RULES) : null;
    const immediateReturnedCredits =
      startedRoundOutcomes?.reduce((sum, entry) => sum + entry.returnedCredits, 0) ?? 0;
    setShoe(started.shoe);
    setRound(started.round);
    triggerDealAnimation(null, DEAL_ANIMATION_MS, INITIAL_DEAL_CARD_ANIMATION_MS);
    setCredits((value) => value - bet + immediateReturnedCredits);
    setFeedbackHistory([]);
    setLastRecommendation(null);
    setHoleCardRevealed(false);
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
    showMoveResultIndicator(feedback.isCorrect);

    if (action === "split") {
      const runSplitAnimation = async () => {
        const originalHand = round.playerHands[round.activeHandIndex];
        if (!originalHand) return;
        if (originalHand.bet > credits) {
          setMessage("Not enough credits for that action.");
          return;
        }

        const [leftCard, rightCard] = originalHand.cards;
        if (!leftCard || !rightCard) return;

        setSplitAnimating(true);
        setCredits((value) => value - originalHand.bet);

        const splitRound: RoundState = {
          ...round,
          dealerHand: [...round.dealerHand],
          playerHands: round.playerHands.map((currentHand, index) => {
            if (index !== round.activeHandIndex) {
              return { ...currentHand, cards: [...currentHand.cards] };
            }
            return {
              id: `${currentHand.id}-left`,
              cards: [leftCard],
              bet: currentHand.bet,
              stood: false,
              doubled: false,
              isSplitHand: true,
            };
          }),
        };

        splitRound.playerHands.splice(round.activeHandIndex + 1, 0, {
          id: `${originalHand.id}-right`,
          cards: [rightCard],
          bet: originalHand.bet,
          stood: false,
          doubled: false,
          isSplitHand: true,
        });

        setRound(splitRound);
        setMessage("You split");
        await pause(SPLIT_STEP_DELAY_MS);

        let nextShoe = shoe;
        setMessage("Deal 1");
        const leftDeal = draw(nextShoe);
        nextShoe = leftDeal.shoe;
        splitRound.playerHands[round.activeHandIndex].cards.push(leftDeal.card);
        triggerDealAnimation(
          [`player-${splitRound.playerHands[round.activeHandIndex].id}-1`],
          DRAW_ANIMATION_MS,
          DRAW_CARD_ANIMATION_MS,
        );
        setRound({
          ...splitRound,
          dealerHand: [...splitRound.dealerHand],
          playerHands: splitRound.playerHands.map((value) => ({ ...value, cards: [...value.cards] })),
        });
        setShoe(nextShoe);
        await pause(SPLIT_STEP_DELAY_MS);

        setMessage("Deal 2");
        const rightDeal = draw(nextShoe);
        nextShoe = rightDeal.shoe;
        splitRound.playerHands[round.activeHandIndex + 1].cards.push(rightDeal.card);
        triggerDealAnimation(
          [`player-${splitRound.playerHands[round.activeHandIndex + 1].id}-1`],
          DRAW_ANIMATION_MS,
          DRAW_CARD_ANIMATION_MS,
        );
        setRound({
          ...splitRound,
          dealerHand: [...splitRound.dealerHand],
          playerHands: splitRound.playerHands.map((value) => ({ ...value, cards: [...value.cards] })),
        });
        setShoe(nextShoe);
        setSplitAnimating(false);
      };

      void runSplitAnimation();
      return;
    }

    const applied = applyAction(round, shoe, action, DEFAULT_RULES);
    if (applied.result.additionalWager > credits) {
      setMessage("Not enough credits for that action.");
      return;
    }
    const bustedIntoDealerReveal =
      (action === "hit" || action === "double") &&
      applied.result.round.phase === "dealerTurn" &&
      applied.result.feedbackMessage.includes("busted");
    if (bustedIntoDealerReveal) {
      dealerRevealDelayMsRef.current = DEALER_REVEAL_DELAY_MS;
      holeRevealStartDelayMsRef.current = HOLE_REVEAL_AFTER_BUST_DRAW_DELAY_MS;
    } else {
      dealerRevealDelayMsRef.current = DEALER_REVEAL_DELAY_MS;
      holeRevealStartDelayMsRef.current = HOLE_REVEAL_START_DELAY_MS;
    }
    setCredits((value) => value - applied.result.additionalWager);
    if (action === "hit" || action === "double") {
      const updatedHand = applied.result.round.playerHands.find((playerHand) => playerHand.id === hand.id);
      if (updatedHand) {
        const newestCardIndex = updatedHand.cards.length - 1;
        triggerDealAnimation([`player-${updatedHand.id}-${newestCardIndex}`], DRAW_ANIMATION_MS, DRAW_CARD_ANIMATION_MS);
      }
    }
    setRound(applied.result.round);
    setShoe(applied.shoe);
    setMessage(applied.result.feedbackMessage);
  };

  return (
    <main className="app">
      <div className="layout">
        <div className="game-surface">
          <p className="table-message">{message}</p>
          <p className="credits-hud">Credits: {credits}</p>
          <div className={isShuffling ? "shoe-stack shuffling" : "shoe-stack"} aria-hidden="true">
            {[0, 1, 2, 3, 4].map((index) =>
              cardImageMap.BACK ? (
                <img
                  key={index}
                  src={cardImageMap.BACK}
                  alt=""
                  className={`shoe-stack-card shoe-stack-card-${index + 1}`}
                />
              ) : (
                <span key={index} className={`shoe-stack-card shoe-stack-card-${index + 1} shoe-stack-fallback`}>
                  ?
                </span>
              ),
            )}
          </div>
          <div className="card-counter-hud" aria-label="Cards remaining in shoe">
            <span className="card-counter-icon" aria-hidden="true">
              A♠
            </span>
            <span>
              {shoe.length}/{INITIAL_SHOE_SIZE}
            </span>
          </div>
          <div className="training-overlay">
            <TrainingPanel
              trainingMode={trainingMode}
              onToggleTrainingMode={setTrainingMode}
              currentRecommendation={recommendation ?? lastRecommendation}
              feedbackHistory={feedbackHistory}
            />
            {round ? <p className="round-indicator">{round.message}</p> : null}
          </div>
          <div className="table-zone">
            <TableView
              round={round}
              cardImageMap={cardImageMap}
              dealAnimationActive={dealAnimationActive}
              dealAnimationTick={dealAnimationTick}
              dealAnimationTargets={dealAnimationTargets}
              dealAnimationDurationMs={dealAnimationDurationMs}
              holeRevealActive={holeRevealActive}
              holeRevealTick={holeRevealTick}
              holeCardRevealed={holeCardRevealed}
              splitAnimating={splitAnimating}
            />
          </div>
          {moveResultIndicator ? (
            <div
              key={moveResultIndicator.tick}
              className={moveResultIndicator.isCorrect ? "move-result-popup correct" : "move-result-popup incorrect"}
              aria-live="polite"
              role="status"
            >
              {moveResultIndicator.isCorrect ? "✓" : "✕"}
            </div>
          ) : null}
          <button type="button" className="deal-button" onClick={handleDeal} disabled={dealDisabled}>
            Deal
          </button>
          <div className="actions-dock">
            <ActionControls
              legalActions={currentLegalActions}
              onAction={handleAction}
              disabled={!round || round.phase !== "playerTurn" || splitAnimating}
              disableDouble={cannotAffordDouble}
            />
          </div>
          <div className="bet-dock">
            <BetControls
              credits={credits}
              bet={bet}
              onBetChange={setBet}
              disabled={round !== null && round.phase !== "roundOver"}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
