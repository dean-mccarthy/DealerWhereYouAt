import type { PlayerAction } from "../game/types";
import type { TrainingFeedback } from "../training/types";

interface TrainingPanelProps {
  trainingMode: boolean;
  onToggleTrainingMode: (enabled: boolean) => void;
  currentRecommendation: PlayerAction | null;
  feedbackHistory: TrainingFeedback[];
}

export const TrainingPanel = ({
  trainingMode,
  onToggleTrainingMode,
  currentRecommendation,
  feedbackHistory,
}: TrainingPanelProps) => (
  <section className="panel">
    <div className="training-panel-header">
      <h2>Strategy Coach</h2>
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
