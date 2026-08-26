import { evaluateHand, canSplit, isSplitAceHand } from "./hand";
import { cardNumericValue } from "./cards";
import { draw } from "./shoe";
import type {
  ActionResult,
  Card,
  HandOutcome,
  HandState,
  PlayerAction,
  RoundState,
  Rules,
} from "./types";

const nextHandId = (() => {
  let id = 0;
  return () => `hand-${id += 1}`;
})();

const cloneRound = (round: RoundState): RoundState => ({
  ...round,
  dealerHand: [...round.dealerHand],
  playerHands: round.playerHands.map((hand) => ({ ...hand, cards: [...hand.cards] })),
});

const findNextActiveIndex = (hands: HandState[], current: number): number => {
  for (let i = current; i < hands.length; i += 1) {
    const value = evaluateHand(hands[i].cards);
    if (!hands[i].stood && !value.isBust) return i;
  }
  return -1;
};

const isTenValueCard = (card: Card): boolean => cardNumericValue(card) === 10;

const canFreeBetSplit = (hand: HandState): boolean => {
  if (hand.cards.length !== 2) return false;
  const [firstCard, secondCard] = hand.cards;
  if (firstCard.rank !== secondCard.rank) return false;
  return !isTenValueCard(firstCard);
};

const canFreeBetDouble = (hand: HandState): boolean => {
  if (hand.cards.length !== 2) return false;
  const value = evaluateHand(hand.cards);
  return !value.isSoft && value.total >= 9 && value.total <= 11;
};

export const legalActions = (round: RoundState, rules: Rules): PlayerAction[] => {
  if (round.phase !== "playerTurn") return [];
  const hand = round.playerHands[round.activeHandIndex];
  const value = evaluateHand(hand.cards);
  if (value.isBust || hand.stood || isSplitAceHand(hand)) return [];

  const actions: PlayerAction[] = ["hit", "stand"];
  const canAttemptDouble = hand.cards.length === 2 && (!hand.isSplitHand || rules.doubleAfterSplit);
  if (canAttemptDouble) {
    actions.push("double");
  }
  if (canSplit(hand)) {
    actions.push("split");
  }
  return actions;
};

export const startRound = (
  shoe: Card[],
  bet: number,
  sideBetWager = 0,
): { round: RoundState; shoe: Card[] } => {
  let nextShoe = shoe;
  const first = draw(nextShoe);
  nextShoe = first.shoe;
  const second = draw(nextShoe);
  nextShoe = second.shoe;
  const dealerOne = draw(nextShoe);
  nextShoe = dealerOne.shoe;
  const dealerTwo = draw(nextShoe);
  nextShoe = dealerTwo.shoe;

  const round: RoundState = {
    phase: "playerTurn",
    playerHands: [
      {
        id: nextHandId(),
        cards: [first.card, second.card],
        bet,
        freeBetPortion: 0,
        stood: false,
        doubled: false,
        isSplitHand: false,
      },
    ],
    dealerHand: [dealerOne.card, dealerTwo.card],
    activeHandIndex: 0,
    message: "Choose an action",
    sideBetWager,
    potOfGoldLammers: 0,
    sideBetSeedCards: [first.card, second.card],
  };

  if (evaluateHand(round.dealerHand).isBlackjack) {
    round.phase = "roundOver";
    round.message = "Dealer has blackjack";
  }

  return { round, shoe: nextShoe };
};

export const settleIfDone = (
  round: RoundState,
  shoe: Card[],
  rules: Rules,
): { round: RoundState; shoe: Card[] } => {
  const next = cloneRound(round);
  const active = findNextActiveIndex(next.playerHands, next.activeHandIndex);
  if (active >= 0) {
    next.activeHandIndex = active;
    return { round: next, shoe };
  }
  next.phase = "dealerTurn";
  next.message = "Dealer reveals hole card";
  return { round: next, shoe };
};

const dealerMustHit = (round: RoundState, rules: Rules): boolean => {
  const dealerValue = evaluateHand(round.dealerHand);
  if (dealerValue.total > 21) return false;
  if (dealerValue.total < 17) return true;
  if (dealerValue.total > 17) return false;
  return rules.dealerHitsSoft17 && dealerValue.isSoft;
};

export const advanceDealerTurn = (
  round: RoundState,
  shoe: Card[],
  rules: Rules,
): { round: RoundState; shoe: Card[] } => {
  const next = cloneRound(round);
  if (next.phase !== "dealerTurn") {
    return { round: next, shoe };
  }

  if (!dealerMustHit(next, rules)) {
    next.phase = "roundOver";
    next.message = "Round complete";
    return { round: next, shoe };
  }

  const dealt = draw(shoe);
  next.dealerHand.push(dealt.card);
  next.message = "Dealer hits";
  return { round: next, shoe: dealt.shoe };
};

export const applyAction = (
  round: RoundState,
  shoe: Card[],
  action: PlayerAction,
  rules: Rules,
): { result: ActionResult; shoe: Card[] } => {
  const next = cloneRound(round);
  const hand = next.playerHands[next.activeHandIndex];
  const actions = legalActions(next, rules);
  if (!actions.includes(action)) {
    return {
      result: {
        round: next,
        additionalWager: 0,
        feedbackMessage: "Action not allowed on this hand",
      },
      shoe,
    };
  }

  let nextShoe = shoe;
  let additionalWager = 0;
  let feedbackMessage = "";

  if (action === "hit") {
    const dealt = draw(nextShoe);
    hand.cards.push(dealt.card);
    nextShoe = dealt.shoe;
    feedbackMessage = "You hit";
  } else if (action === "stand") {
    hand.stood = true;
    feedbackMessage = "You stand";
  } else if (action === "double") {
    const freeBetDoubleAllowed = rules.gameMode === "freeBet" && canFreeBetDouble(hand);
    const dealt = draw(nextShoe);
    hand.cards.push(dealt.card);
    nextShoe = dealt.shoe;
    const doubleAmount = hand.bet;
    hand.bet *= 2;
    if (freeBetDoubleAllowed) {
      hand.freeBetPortion += doubleAmount;
      next.potOfGoldLammers = (next.potOfGoldLammers ?? 0) + 1;
      additionalWager = 0;
      feedbackMessage = "You doubled for free";
    } else {
      additionalWager = hand.bet / 2;
      feedbackMessage = "You doubled";
    }
    hand.doubled = true;
    hand.stood = true;
  } else if (action === "split") {
    const freeSplitAllowed = rules.gameMode === "freeBet" && canFreeBetSplit(hand);
    const [leftCard, rightCard] = hand.cards;
    const leftDeal = draw(nextShoe);
    nextShoe = leftDeal.shoe;
    const rightDeal = draw(nextShoe);
    nextShoe = rightDeal.shoe;
    const originalBet = hand.bet;
    const splitAces = leftCard.rank === "A";
    const left: HandState = {
      id: nextHandId(),
      cards: [leftCard, leftDeal.card],
      bet: originalBet,
      freeBetPortion: 0,
      stood: splitAces,
      doubled: false,
      isSplitHand: true,
    };
    const right: HandState = {
      id: nextHandId(),
      cards: [rightCard, rightDeal.card],
      bet: originalBet,
      freeBetPortion: freeSplitAllowed ? originalBet : 0,
      stood: splitAces,
      doubled: false,
      isSplitHand: true,
    };
    next.playerHands.splice(next.activeHandIndex, 1, left, right);
    if (freeSplitAllowed) {
      next.potOfGoldLammers = (next.potOfGoldLammers ?? 0) + 1;
      additionalWager = 0;
      feedbackMessage = "You split for free";
    } else {
      additionalWager = originalBet;
      feedbackMessage = "You split";
    }
  }

  const activeHand = next.playerHands[next.activeHandIndex];
  const activeValue = evaluateHand(activeHand.cards);
  if (activeValue.isBust) {
    activeHand.stood = true;
    feedbackMessage += " and busted";
  }

  const settled = settleIfDone(next, nextShoe, rules);
  return {
    result: {
      round: settled.round,
      additionalWager,
      feedbackMessage,
    },
    shoe: settled.shoe,
  };
};

export const resolveOutcomes = (round: RoundState, rules: Rules): HandOutcome[] => {
  const dealerValue = evaluateHand(round.dealerHand);
  const dealerPush22 = rules.gameMode === "freeBet" && dealerValue.total === 22;

  return round.playerHands.map((hand) => {
    const playerValue = evaluateHand(hand.cards);
    if (playerValue.isBust) {
      return { handId: hand.id, result: "loss", returnedCredits: 0 };
    }

    if (playerValue.isBlackjack && !dealerValue.isBlackjack && !hand.isSplitHand) {
      return {
        handId: hand.id,
        result: "blackjack",
        returnedCredits: hand.bet * (1 + rules.blackjackPayout),
      };
    }

    if (dealerPush22) {
      return { handId: hand.id, result: "push", returnedCredits: hand.bet - hand.freeBetPortion };
    }

    if (dealerValue.isBust) {
      return {
        handId: hand.id,
        result: "win",
        returnedCredits: hand.bet * 2 - hand.freeBetPortion,
      };
    }

    if (dealerValue.total > playerValue.total) {
      return { handId: hand.id, result: "loss", returnedCredits: 0 };
    }

    if (dealerValue.total < playerValue.total) {
      return {
        handId: hand.id,
        result: "win",
        returnedCredits: hand.bet * 2 - hand.freeBetPortion,
      };
    }

    return { handId: hand.id, result: "push", returnedCredits: hand.bet - hand.freeBetPortion };
  });
};
