import type { PlayerAction } from "../game/types";

interface ActionControlsProps {
  legalActions: PlayerAction[];
  disabled: boolean;
  disableDouble?: boolean;
  onAction: (action: PlayerAction) => void;
}

const LABELS: Record<PlayerAction, string> = {
  hit: "Hit",
  stand: "Stand",
  double: "Double",
  split: "Split",
};

export const ActionControls = ({ legalActions, disabled, disableDouble = false, onAction }: ActionControlsProps) => (
  <section className="panel">
    <div className="actions">
      {(["hit", "stand", "double", "split"] as PlayerAction[]).map((action) => (
        <button
          key={action}
          type="button"
          className={`action-button action-${action}`}
          disabled={disabled || !legalActions.includes(action) || (action === "double" && disableDouble)}
          onClick={() => onAction(action)}
        >
          {LABELS[action]}
        </button>
      ))}
    </div>
  </section>
);
