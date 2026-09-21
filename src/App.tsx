import { useEffect, useMemo, useRef, useState } from "react";
import { ActionControls } from "./components/ActionControls";
import { BetControls } from "./components/BetControls";
import { TableView } from "./components/TableView";
import { TrainingPanel } from "./components/TrainingPanel";
import { fetchCardImageMap } from "./game/deckApi";
import { advanceDealerTurn, applyAction, legalActions, resolveOutcomes, settleIfDone, startRound } from "./game/engine";
import { evaluateHand } from "./game/hand";
import { cardNumericValue } from "./game/cards";
import { DEFAULT_RULES, FREE_BET_RULES } from "./game/rules";
import { createShoe, draw } from "./game/shoe";
import { resolvePairSideBet, resolvePotOfGoldSideBet, type SideBetOutcome } from "./game/sideBet";
import type { Card, PlayerAction, RoundState, Rules } from "./game/types";
import { recommendedActionFromBasicStrategy } from "./training/strategyTable";
import { getTrainingFeedback } from "./training/advisor";
import type { TrainingFeedback } from "./training/types";

const STARTING_CREDITS = 1000;
const SHOE_RESHUFFLE_PENETRATION = 0.5;
const getShoeSize = (rules: Rules) => rules.deckCount * 52;

const ensureShoe = (shoe: Card[], rules: Rules): Card[] =>
  shoe.length <= Math.floor(getShoeSize(rules) * SHOE_RESHUFFLE_PENETRATION)
    ? createShoe(rules.deckCount)
    : shoe;
const DEALER_REVEAL_DELAY_MS = 900;
const DEALER_STEP_DELAY_MS = 1000;
const SPLIT_STEP_DELAY_MS = 620;
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
  const [gameMode, setGameMode] = useState<"classic" | "freeBet">("classic");
  const activeRules = useMemo(() => (gameMode === "freeBet" ? FREE_BET_RULES : DEFAULT_RULES), [gameMode]);
  const sideBetTitle = gameMode === "freeBet" ? "Pot of Gold" : "Perfect Pair";
  const [credits, setCredits] = useState(STARTING_CREDITS);
  const [bet, setBet] = useState(0);
  const [sideBet, setSideBet] = useState(0);
  const [shoe, setShoe] = useState<Card[]>(() => createShoe(activeRules.deckCount));
  const [round, setRound] = useState<RoundState | null>(null);
  const [message, setMessage] = useState("Welcome to Blackjack Trainer.");
  const [currentRoundSideBetWon, setCurrentRoundSideBetWon] = useState<boolean | null>(null);
  const [trainingMode, setTrainingMode] = useState(true);
  const [instantPopupEnabled, setInstantPopupEnabled] = useState(true);
  const [feedbackHistory, setFeedbackHistory] = useState<TrainingFeedback[]>([]);
  const [totalMoves, setTotalMoves] = useState(0);
  const [correctMoves, setCorrectMoves] = useState(0);
  const [lastRecommendation, setLastRecommendation] = useState<PlayerAction | null>(null);
  const [cardImageMap, setCardImageMap] = useState<Record<string, string>>({});
  const [splitAnimating, setSplitAnimating] = useState(false);
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
      if (dealTimeoutRef.current) clearTimeout(dealTimeoutRef.current);
      if (holeRevealTimeoutRef.current) clearTimeout(holeRevealTimeoutRef.current);
      if (holeRevealStartTimeoutRef.current) clearTimeout(holeRevealStartTimeoutRef.current);
      if (moveResultTimeoutRef.current) clearTimeout(moveResultTimeoutRef.current);
    },
    [],
  );

  const currentLegalActions = useMemo(
    () => (round ? legalActions(round, activeRules) : []),
    [activeRules, round],
  );
  const cannotAffordDouble = useMemo(() => {
    if (!round || round.phase !== "playerTurn") return false;
    const activeHand = round.playerHands[round.activeHandIndex];
    if (activeRules.gameMode === "freeBet") {
      const value = evaluateHand(activeHand.cards);
      const isFreeDoubleWindow = activeHand.cards.length === 2 && !value.isSoft && value.total >= 9 && value.total <= 11;
      if (isFreeDoubleWindow) return false;
    }
    return activeHand.bet > credits;
  }, [activeRules.gameMode, credits, round]);
  const dealDisabled = (round !== null && round.phase !== "roundOver") || bet < activeRules.minBet || splitAnimating;
  const accuracyPercent = totalMoves > 0 ? Math.round((correctMoves / totalMoves) * 100) : 0;

  const recommendation = useMemo(() => {
    if (!round || round.phase !== "playerTurn") return null;
    const hand = round.playerHands[round.activeHandIndex];
    return recommendedActionFromBasicStrategy(
      hand.cards,
      round.dealerHand[0],
      currentLegalActions,
      activeRules.gameMode,
      hand.freeBetPortion > 0,
    );
  }, [activeRules.gameMode, currentLegalActions, round]);

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
        const advanced = advanceDealerTurn(animatedRound, animatedShoe, activeRules);
        animatedRound = advanced.round;
        animatedShoe = advanced.shoe;
        if (animatedRound.dealerHand.length > dealerCardCountBefore) {
          const newestDealerCardIndex = animatedRound.dealerHand.length - 1;
          triggerDealAnimation([`dealer-${newestDealerCardIndex}`], DRAW_ANIMATION_MS, DRAW_CARD_ANIMATION_MS);
        }
        setRound(animatedRound);
        setShoe(animatedShoe);

        if (animatedRound.phase === "roundOver") {
          const outcomes = resolveOutcomes(animatedRound, activeRules);
          const sideBetOutcome = activeRules.gameMode === "freeBet" ? resolveCurrentSideBet(animatedRound) : null;
          const returnedCredits = outcomes.reduce((sum, entry) => sum + entry.returnedCredits, 0);
          const sideBetReturnedCredits = sideBetOutcome?.returnedCredits ?? 0;
          setCredits((value) => value + returnedCredits + sideBetReturnedCredits);
          if (sideBetOutcome) {
            setCurrentRoundSideBetWon(sideBetOutcome.won);
          }
          const outcomeText = outcomes
            .map((entry, index) => `Hand ${index + 1}: ${entry.result} (+${entry.returnedCredits})`)
            .join(" | ");
          const sideBetSummary = sideBetOutcome
            ? sideBetOutcome.won
              ? `${sideBetOutcome.name}: ${sideBetOutcome.payoutLabel} (+${sideBetOutcome.returnedCredits})`
              : `${sideBetOutcome.name}: ${sideBetOutcome.payoutLabel} (+0)`
            : null;
          setMessage(sideBetSummary ? `Round complete. ${outcomeText} | ${sideBetSummary}` : `Round complete. ${outcomeText}`);
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
  }, [activeRules, round?.phase]);

  const validateBet = (candidateBet: number): string | null => {
    if (!Number.isFinite(candidateBet)) return "Enter a valid bet.";
    if (candidateBet < activeRules.minBet) return `Minimum bet is ${activeRules.minBet}.`;
    if (candidateBet % activeRules.betStep !== 0) {
      return `Bet must be in increments of ${activeRules.betStep}.`;
    }
    if (candidateBet > credits) return "Not enough credits.";
    return null;
  };

  const validateSideBet = (candidateSideBet: number, candidateBet: number): string | null => {
    if (!Number.isFinite(candidateSideBet) || candidateSideBet < 0) return "Enter a valid side bet.";
    if (candidateSideBet % activeRules.betStep !== 0) {
      return `Side bet must be in increments of ${activeRules.betStep}.`;
    }
    if (candidateSideBet > candidateBet) return "Side bet cannot exceed main bet.";
    if (candidateBet + candidateSideBet > credits) return "Not enough credits for both bets.";
    return null;
  };

  const handleBetChange = (candidateBet: number) => {
    const clampedBet = Math.max(0, candidateBet);
    if (clampedBet + sideBet > credits) return;
    setBet(clampedBet);
    if (sideBet > clampedBet) {
      setSideBet(clampedBet);
    }
  };

  const handleSideBetChange = (candidateSideBet: number) => {
    const nextSideBet = Math.max(0, candidateSideBet);
    if (validateSideBet(nextSideBet, bet)) return;
    setSideBet(nextSideBet);
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

  const resolveCurrentSideBet = (roundState: RoundState): SideBetOutcome | null => {
    const wager = roundState.sideBetWager ?? 0;
    if (activeRules.gameMode === "freeBet") {
      return resolvePotOfGoldSideBet(roundState.potOfGoldLammers ?? 0, wager, sideBetTitle);
    }
    return resolvePairSideBet(roundState.sideBetSeedCards ?? [], wager, sideBetTitle);
  };

  const canStillCollectPotOfGoldToken = (roundState: RoundState): boolean => {
    if (activeRules.gameMode !== "freeBet") return false;
    if (roundState.phase !== "playerTurn") return false;

    return roundState.playerHands.some((hand) => {
      if (hand.stood) return false;
      const value = evaluateHand(hand.cards);
      if (value.isBust) return false;
      if (hand.cards.length !== 2) return false;

      const [firstCard, secondCard] = hand.cards;
      if (!firstCard || !secondCard) return false;

      const isFreeSplitCandidate = firstCard.rank === secondCard.rank && cardNumericValue(firstCard) !== 10;
      const isFreeDoubleCandidate = !value.isSoft && value.total >= 9 && value.total <= 11;
      return isFreeSplitCandidate || isFreeDoubleCandidate;
    });
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
    const sideBetValidationError = validateSideBet(sideBet, bet);
    if (sideBetValidationError) {
      setMessage(sideBetValidationError);
      return;
    }
    setCurrentRoundSideBetWon(null);
    const replenishedShoe = ensureShoe(shoe, activeRules);
    const started = startRound(replenishedShoe, bet, sideBet);
    const startedRoundOutcomes =
      started.round.phase === "roundOver" ? resolveOutcomes(started.round, activeRules) : null;
    const resolveSideBetNow = activeRules.gameMode !== "freeBet" || started.round.phase === "roundOver";
    const sideBetOutcome = resolveSideBetNow ? resolveCurrentSideBet(started.round) : null;
    const immediateReturnedCredits =
      startedRoundOutcomes?.reduce((sum, entry) => sum + entry.returnedCredits, 0) ?? 0;
    const sideBetReturnedCredits = sideBetOutcome?.returnedCredits ?? 0;
    const sideBetSummary = sideBetOutcome
      ? sideBetOutcome.won
        ? `${sideBetTitle}: ${sideBetOutcome.payoutLabel} (+${sideBetOutcome.returnedCredits})`
        : `${sideBetTitle}: ${sideBetOutcome.payoutLabel} (+0)`
      : null;
    setCurrentRoundSideBetWon(sideBetOutcome ? sideBetOutcome.won : null);
    setShoe(started.shoe);
    setRound(started.round);
    triggerDealAnimation(null, DEAL_ANIMATION_MS, INITIAL_DEAL_CARD_ANIMATION_MS);
    setCredits((value) => value - bet - sideBet + immediateReturnedCredits + sideBetReturnedCredits);
    setFeedbackHistory([]);
    setLastRecommendation(null);
    setHoleCardRevealed(false);
    if (startedRoundOutcomes) {
      const outcomeText = startedRoundOutcomes
        .map((entry, index) => `Hand ${index + 1}: ${entry.result} (+${entry.returnedCredits})`)
        .join(" | ");
      setMessage(sideBetSummary ? `Round complete. ${outcomeText} | ${sideBetSummary}` : `Round complete. ${outcomeText}`);
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
        gameMode: activeRules.gameMode,
        isFreeBetHand: hand.freeBetPortion > 0,
      },
      action,
    );
    setFeedbackHistory((value) => [...value, feedback]);
    setTotalMoves((value) => value + 1);
    if (feedback.isCorrect) {
      setCorrectMoves((value) => value + 1);
    }
    if (instantPopupEnabled) {
      showMoveResultIndicator(feedback.isCorrect);
    }

    if (action === "split") {
      const runSplitAnimation = async () => {
        const originalHand = round.playerHands[round.activeHandIndex];
        if (!originalHand) return;
        const [leftCard, rightCard] = originalHand.cards;
        if (!leftCard || !rightCard) return;
        const isFreeBetSplit =
          activeRules.gameMode === "freeBet" &&
          leftCard.rank === rightCard.rank &&
          cardNumericValue(leftCard) !== 10;
        if (!isFreeBetSplit && originalHand.bet > credits) {
          setMessage("Not enough credits for that action.");
          return;
        }

        setSplitAnimating(true);
        if (!isFreeBetSplit) {
          setCredits((value) => value - originalHand.bet);
        }

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
              freeBetPortion: currentHand.freeBetPortion,
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
          freeBetPortion: isFreeBetSplit ? originalHand.bet : 0,
          stood: false,
          doubled: false,
          isSplitHand: true,
        });
        if (isFreeBetSplit) {
          splitRound.potOfGoldLammers = (splitRound.potOfGoldLammers ?? 0) + 1;
        }

        setRound(splitRound);
        setMessage(isFreeBetSplit ? "You split for free" : "You split");
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
        const splitAces = leftCard.rank === "A";
        if (splitAces) {
          splitRound.playerHands[round.activeHandIndex].stood = true;
          splitRound.playerHands[round.activeHandIndex + 1].stood = true;
        }
        const finishedRound = {
          ...splitRound,
          dealerHand: [...splitRound.dealerHand],
          playerHands: splitRound.playerHands.map((value) => ({ ...value, cards: [...value.cards] })),
        };
        const settled = splitAces ? settleIfDone(finishedRound, nextShoe, activeRules) : { round: finishedRound, shoe: nextShoe };
        setRound(settled.round);
        setShoe(settled.shoe);
        if (splitAces) {
          setMessage(settled.round.message);
        }
        setSplitAnimating(false);
      };

      void runSplitAnimation();
      return;
    }

    const applied = applyAction(round, shoe, action, activeRules);
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

  const potOfGoldMarkedDead =
    activeRules.gameMode === "freeBet" &&
    !!round &&
    (round.potOfGoldLammers ?? 0) === 0 &&
    !canStillCollectPotOfGoldToken(round);

  const displaySideBetWon = potOfGoldMarkedDead ? false : currentRoundSideBetWon;

  return (
    <main className="app">
      <div className="layout">
        <div className={gameMode === "freeBet" ? "game-surface free-bet" : "game-surface"}>
          <p className="table-message">{message}</p>
          <p className="credits-hud">Credits: {credits}</p>
          <div className="side-bet-odds-hud" aria-label={`${sideBetTitle} payouts`}>
            <p className="side-bet-odds-title">{sideBetTitle}</p>
            <table className="side-bet-odds-table" aria-hidden="true">
              <tbody>
                {gameMode === "freeBet" ? (
                  <>
                    <tr>
                      <td>7 Tokens</td>
                      <td>1000:1</td>
                    </tr>
                    <tr>
                      <td>6 Tokens</td>
                      <td>300:1</td>
                    </tr>
                    <tr>
                      <td>5 Tokens</td>
                      <td>100:1</td>
                    </tr>
                    <tr>
                      <td>4 Tokens</td>
                      <td>60:1</td>
                    </tr>
                    <tr>
                      <td>3 Tokens</td>
                      <td>30:1</td>
                    </tr>
                    <tr>
                      <td>2 Tokens</td>
                      <td>10:1</td>
                    </tr>
                    <tr>
                      <td>1 Token</td>
                      <td>3:1</td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr>
                      <td>Mixed Pair</td>
                      <td>7:1</td>
                    </tr>
                    <tr>
                      <td>Colored Pair</td>
                      <td>15:1</td>
                    </tr>
                    <tr>
                      <td>Perfect Pair</td>
                      <td>30:1</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          <div className="training-overlay">
            <div className="game-mode-toggle" role="group" aria-label="Game mode">
              <button
                type="button"
                className={gameMode === "classic" ? "mode-button active" : "mode-button"}
                onClick={() => setGameMode("classic")}
                disabled={round !== null && round.phase !== "roundOver"}
              >
                Classic
              </button>
              <button
                type="button"
                className={gameMode === "freeBet" ? "mode-button active" : "mode-button"}
                onClick={() => setGameMode("freeBet")}
                disabled={round !== null && round.phase !== "roundOver"}
              >
                Free Bet
              </button>
            </div>
            <TrainingPanel
              trainingMode={trainingMode}
              onToggleTrainingMode={setTrainingMode}
              instantPopupEnabled={instantPopupEnabled}
              onToggleInstantPopup={setInstantPopupEnabled}
              currentRecommendation={recommendation ?? lastRecommendation}
              feedbackHistory={feedbackHistory}
            />
            {round ? <p className="round-indicator">{round.message}</p> : null}
          </div>
          <div className="table-zone">
            <TableView
              round={round}
              sideBetWon={displaySideBetWon}
              sideBetTitle={sideBetTitle}
              gameMode={gameMode}
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
              sideBet={sideBet}
              sideBetWon={displaySideBetWon}
              sideBetTitle={sideBetTitle}
              onBetChange={handleBetChange}
              onSideBetChange={handleSideBetChange}
              disabled={round !== null && round.phase !== "roundOver"}
              round={round}
            />
          </div>
        </div>
        <aside className="coach-stats-panel" aria-label="Training accuracy stats">
          <p className="coach-stats-line">Moves: {totalMoves}</p>
          <p className="coach-stats-line">Correct: {correctMoves}</p>
          <p className="coach-stats-percent">Accuracy: {accuracyPercent}%</p>
        </aside>
      </div>
    </main>
  );
}

export default App;
