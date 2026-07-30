import { evaluateHand, canSplit } from "./hand";
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

export const legalActions = (round: RoundState, rules: Rules): PlayerAction[] => {
  if (round.phase !== "playerTurn") return [];
  const hand = round.playerHands[round.activeHandIndex];
  const value = evaluateHand(hand.cards);
  if (value.isBust || hand.stood) return [];

  const actions: PlayerAction[] = ["hit", "stand"];
  if (hand.cards.length === 2 && (!hand.isSplitHand || rules.doubleAfterSplit)) {
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
        stood: false,
        doubled: false,
        isSplitHand: false,
      },
    ],
    dealerHand: [dealerOne.card, dealerTwo.card],
    activeHandIndex: 0,
    message: "Choose an action",
  };

  if (evaluateHand(round.dealerHand).isBlackjack) {
    round.phase = "roundOver";
    round.message = "Dealer has blackjack";
  }

  return { round, shoe: nextShoe };
};

const settleIfDone = (
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
    const dealt = draw(nextShoe);
    hand.cards.push(dealt.card);
    nextShoe = dealt.shoe;
    hand.bet *= 2;
    hand.doubled = true;
    hand.stood = true;
    additionalWager = hand.bet / 2;
    feedbackMessage = "You doubled";
  } else if (action === "split") {
    const [leftCard, rightCard] = hand.cards;
    const leftDeal = draw(nextShoe);
    nextShoe = leftDeal.shoe;
    const rightDeal = draw(nextShoe);
    nextShoe = rightDeal.shoe;
    const originalBet = hand.bet;
    const left: HandState = {
      id: nextHandId(),
      cards: [leftCard, leftDeal.card],
      bet: originalBet,
      stood: false,
      doubled: false,
      isSplitHand: true,
    };
    const right: HandState = {
      id: nextHandId(),
      cards: [rightCard, rightDeal.card],
      bet: originalBet,
      stood: false,
      doubled: false,
      isSplitHand: true,
    };
    next.playerHands.splice(next.activeHandIndex, 1, left, right);
    additionalWager = originalBet;
    feedbackMessage = "You split";
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

    if (dealerValue.isBust) {
      return {
        handId: hand.id,
        result: "win",
        returnedCredits: hand.bet * 2,
      };
    }

    if (dealerValue.total > playerValue.total) {
      return { handId: hand.id, result: "loss", returnedCredits: 0 };
    }

    if (dealerValue.total < playerValue.total) {
      return {
        handId: hand.id,
        result: "win",
        returnedCredits: hand.bet * 2,
      };
    }

    return { handId: hand.id, result: "push", returnedCredits: hand.bet };
  });
};
