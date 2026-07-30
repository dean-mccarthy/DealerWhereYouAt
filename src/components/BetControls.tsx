interface BetControlsProps {
  credits: number;
  bet: number;
  onBetChange: (bet: number) => void;
  disabled: boolean;
}

const CHIP_VALUES = [5, 25, 100, 500] as const;

export const BetControls = ({
  credits,
  bet,
  onBetChange,
  disabled,
}: BetControlsProps) => {
  const canClear = !disabled && bet > 0;

  const handleChipClick = (chipValue: number) => {
    const nextBet = bet + chipValue;
    if (nextBet > credits) return;
    onBetChange(nextBet);
  };

  return (
    <section className="panel">
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
