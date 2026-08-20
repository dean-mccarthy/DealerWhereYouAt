import type { RoundState } from "../game/types";

interface BetControlsProps {
  credits: number;
  bet: number;
  onBetChange: (bet: number) => void;
  disabled: boolean;
  round: RoundState | null;
}

const CHIP_VALUES = [5, 25, 100, 500] as const;
const CHIP_COLOR_CLASS_BY_VALUE: Record<number, string> = {
  5: "chip-red",
  25: "chip-blue",
  100: "chip-white",
  500: "chip-green",
};

export const BetControls = ({
  credits,
  bet,
  onBetChange,
  disabled,
  round,
}: BetControlsProps) => {
  const canClear = !disabled && bet > 0;
  const showingActiveRoundWagers = round !== null && round.phase !== "roundOver";
  const baseWager = bet > 0 ? bet : showingActiveRoundWagers ? (round?.playerHands[0]?.bet ?? 0) : 0;

  const paidWagerTotal = showingActiveRoundWagers
    ? round.playerHands.reduce((sum, hand) => sum + Math.max(0, hand.bet - hand.freeBetPortion), 0)
    : bet;
  const freeWagerTotal = showingActiveRoundWagers ? round.playerHands.reduce((sum, hand) => sum + hand.freeBetPortion, 0) : 0;
  const stackCount = baseWager > 0 ? Math.max(1, Math.round(paidWagerTotal / baseWager)) : 0;
  const freeChipCount = baseWager > 0 ? Math.round(freeWagerTotal / baseWager) : 0;

  const wagerChips = (() => {
    const chips: number[] = [];
    let remainder = baseWager;
    const descendingChipValues = [...CHIP_VALUES].sort((a, b) => b - a);
    for (const chipValue of descendingChipValues) {
      while (remainder >= chipValue) {
        chips.push(chipValue);
        remainder -= chipValue;
      }
    }
    if (remainder > 0) chips.push(remainder);
    return chips.length > 0 ? chips : [0];
  })();

  const handleChipClick = (chipValue: number) => {
    const nextBet = bet + chipValue;
    if (nextBet > credits) return;
    onBetChange(nextBet);
  };

  return (
    <section className="panel">
      <div className="wager-stack-area" aria-live="polite">
        {stackCount > 0
          ? Array.from({ length: stackCount }).map((_, stackIndex) => (
              <div key={`stack-${stackIndex}`} className="wager-stack" aria-label={`Wager stack ${stackIndex + 1}`}>
                {wagerChips.map((chipValue, chipIndex) => (
                  <span
                    key={`stack-${stackIndex}-chip-${chipIndex}`}
                    className={`wager-chip ${CHIP_COLOR_CLASS_BY_VALUE[chipValue] ?? "chip-red"}`}
                    style={{ bottom: `${chipIndex * 12}px` }}
                  >
                    {chipValue > 0 ? `$${chipValue}` : "$0"}
                  </span>
                ))}
              </div>
            ))
          : null}
        {freeChipCount > 0
          ? Array.from({ length: freeChipCount }).map((_, freeIndex) => (
              <span key={`free-chip-${freeIndex}`} className="wager-chip free-bet-chip">
                Free Bet
              </span>
            ))
          : null}
      </div>
      <p>Current bet: {bet}</p>
      <div className="chip-row">
        {CHIP_VALUES.map((chipValue) => (
          <button
            key={chipValue}
            type="button"
            className="chip"
            disabled={disabled || bet + chipValue > credits}
            onClick={() => handleChipClick(chipValue)}
          >
            ${chipValue}
          </button>
        ))}
        <button type="button" className="clear-button" onClick={() => onBetChange(0)} disabled={!canClear}>
          Clear
        </button>
      </div>
    </section>
  );
};
