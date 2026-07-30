import { evaluateHand } from "../game/hand";
import { cardCode } from "../game/cards";
import type { Card } from "../game/types";
import type { RoundState } from "../game/types";

interface TableViewProps {
  round: RoundState | null;
  cardImageMap: Record<string, string>;
  dealAnimationActive: boolean;
  dealAnimationTick: number;
  dealAnimationTargets: string[] | null;
  holeRevealActive: boolean;
  holeRevealTick: number;
  holeCardRevealed: boolean;
  splitAnimating: boolean;
}

const CardStrip = ({
  cards,
  cardImageMap,
  hideSecondCard = false,
  dealAnimationActive = false,
  dealAnimationTick = 0,
  animationStartIndex = 0,
  stripId,
  dealAnimationTargets = null,
  holeRevealActive = false,
  holeRevealTick = 0,
  reserveSecondSlot = false,
}: {
  cards: Card[];
  cardImageMap: Record<string, string>;
  hideSecondCard?: boolean;
  dealAnimationActive?: boolean;
  dealAnimationTick?: number;
  animationStartIndex?: number;
  stripId: string;
  dealAnimationTargets?: string[] | null;
  holeRevealActive?: boolean;
  holeRevealTick?: number;
  reserveSecondSlot?: boolean;
}) => (
  <div className="card-strip">
    {cards.map((card, index) => {
      const targetId = `${stripId}-${index}`;
      const shouldAnimateCard =
        dealAnimationActive && (dealAnimationTargets === null || dealAnimationTargets.includes(targetId));
      const cardClassName = shouldAnimateCard ? "playing-card dealing-card" : "playing-card";
      const fallbackClassName = shouldAnimateCard ? "card-fallback dealing-card" : "card-fallback";
      const backClassName = shouldAnimateCard ? "playing-card dealing-card" : "playing-card";
      const delayMs = dealAnimationTargets === null ? (animationStartIndex + index) * 120 : 0;
      const animationStyle = shouldAnimateCard ? { animationDelay: `${delayMs}ms` } : undefined;
      const keyPrefix = dealAnimationActive ? `${dealAnimationTick}-` : "";

      if (hideSecondCard && index === 1) {
        const backImage = cardImageMap.BACK;
        if (backImage) {
          return (
            <img
              key={`${keyPrefix}dealer-hole-card`}
              src={backImage}
              alt="Dealer hole card"
              className={backClassName}
              style={animationStyle}
            />
          );
        }
        return (
          <span key={`${keyPrefix}dealer-hole-card`} className="card-back" aria-label="Dealer hole card">
            ?
          </span>
        );
      }

      if (stripId === "dealer" && index === 1 && holeRevealActive) {
        const backImage = cardImageMap.BACK;
        const code = cardCode(card);
        const frontImage = cardImageMap[code];
        const flipKey = `${holeRevealTick}-dealer-hole-reveal`;
        return (
          <span key={flipKey} className="hole-reveal-card">
            <span className="hole-reveal-face hole-reveal-front">
              {frontImage ? (
                <img src={frontImage} alt={`${card.rank} of ${card.suit}`} className="playing-card" />
              ) : (
                <span className="card-fallback">
                  {card.rank}
                  {card.suit[0].toUpperCase()}
                </span>
              )}
            </span>
            <span className="hole-reveal-face hole-reveal-back">
              {backImage ? (
                <img src={backImage} alt="Dealer hole card" className="playing-card" />
              ) : (
                <span className="card-back">?</span>
              )}
            </span>
          </span>
        );
      }

      const code = cardCode(card);
      const image = cardImageMap[code];
      if (!image) {
        return (
          <span key={`${keyPrefix}${code}-${index}`} className={fallbackClassName} style={animationStyle}>
            {card.rank}
            {card.suit[0].toUpperCase()}
          </span>
        );
      }
      return (
        <img
          key={`${keyPrefix}${code}-${index}`}
          src={image}
          alt={`${card.rank} of ${card.suit}`}
          className={cardClassName}
          style={animationStyle}
        />
      );
    })}
    {reserveSecondSlot ? <span className="card-slot-placeholder" aria-hidden="true" /> : null}
  </div>
);

export const TableView = ({
  round,
  cardImageMap,
  dealAnimationActive,
  dealAnimationTick,
  dealAnimationTargets,
  holeRevealActive,
  holeRevealTick,
  holeCardRevealed,
  splitAnimating,
}: TableViewProps) => {
  if (!round) {
    return (
      <section className="panel table-panel">
        <p>Place a bet and click Deal to start.</p>
      </section>
    );
  }

  const dealerValue = evaluateHand(round.dealerHand);
  const shouldHideDealerHoleCard =
    round.phase === "playerTurn" || (round.phase === "dealerTurn" && !holeCardRevealed);
  const dealerTotal = shouldHideDealerHoleCard ? "-" : String(dealerValue.total);

  return (
    <section className="panel table-panel">
      <div className="hand-block dealer-hand">
        <h3>Dealer</h3>
        <CardStrip
          cards={round.dealerHand}
          cardImageMap={cardImageMap}
          hideSecondCard={shouldHideDealerHoleCard}
          dealAnimationActive={dealAnimationActive}
          dealAnimationTick={dealAnimationTick}
          animationStartIndex={0}
          stripId="dealer"
          dealAnimationTargets={dealAnimationTargets}
          holeRevealActive={holeRevealActive}
          holeRevealTick={holeRevealTick}
        />
        <p>
          Total: {dealerTotal}
          {!shouldHideDealerHoleCard && dealerValue.isBust ? <span className="bad"> Bust!</span> : null}
        </p>
      </div>
      <div className="player-hands">
        {round.playerHands.map((hand, index) => {
          const value = evaluateHand(hand.cards);
          return (
            <div key={hand.id} className={index === round.activeHandIndex ? "hand-block active" : "hand-block"}>
              <h3>Player Hand {index + 1}</h3>
              <CardStrip
                cards={hand.cards}
                cardImageMap={cardImageMap}
                dealAnimationActive={dealAnimationActive}
                dealAnimationTick={dealAnimationTick}
                animationStartIndex={2 + index * 2}
                stripId={`player-${hand.id}`}
                dealAnimationTargets={dealAnimationTargets}
                holeRevealActive={holeRevealActive}
                holeRevealTick={holeRevealTick}
                reserveSecondSlot={splitAnimating && hand.isSplitHand && hand.cards.length === 1}
              />
              <p>
                Total: {value.total}
                {value.isBust ? <span className="bad"> Bust!</span> : null}
              </p>
              <p>Bet: {hand.bet}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
