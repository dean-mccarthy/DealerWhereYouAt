import type { PlayerAction } from "../game/types";
import type { TrainingFeedback } from "../training/types";

interface TrainingPanelProps {
  trainingMode: boolean;
  onToggleTrainingMode: (enabled: boolean) => void;
  instantPopupEnabled: boolean;
  onToggleInstantPopup: (enabled: boolean) => void;
  currentRecommendation: PlayerAction | null;
  feedbackHistory: TrainingFeedback[];
}

export const TrainingPanel = ({
  trainingMode,
  onToggleTrainingMode,
  instantPopupEnabled,
  onToggleInstantPopup,
  currentRecommendation,
  feedbackHistory,
}: TrainingPanelProps) => (
  <section className="panel">
    <div className="training-panel-header">
      <h2>Strategy Coach</h2>
      <label className="instant-popup-toggle">
        <input
          type="checkbox"
          className="instant-popup-input"
          checked={instantPopupEnabled}
          onChange={(event) => onToggleInstantPopup(event.target.checked)}
          aria-label="Toggle feedback popup"
        />
        <span>Feedback</span>
        <span className="instant-popup-slider" aria-hidden="true" />
      </label>
      <button
        type="button"
        className="training-toggle"
        onClick={() => onToggleTrainingMode(!trainingMode)}
        aria-expanded={trainingMode}
        aria-label={trainingMode ? "Collapse strategy coach" : "Expand strategy coach"}
      >
        <span className={trainingMode ? "training-toggle-arrow expanded" : "training-toggle-arrow"}>▸</span>
      </button>
    </div>
    {trainingMode && (
      <>
        <p>
          Recommended now: <strong>{currentRecommendation ?? "-"}</strong>
        </p>
        <div className="history">
          {feedbackHistory.slice(-6).reverse().map((item, index) => (
            <p key={`${item.chosenAction}-${index}`} className={item.isCorrect ? "good" : "bad"}>
              {item.explanation}
            </p>
          ))}
        </div>
      </>
    )}
  </section>
);
