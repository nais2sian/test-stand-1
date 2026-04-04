import { useMemo } from "react";
import ScenarioOneBaseline from "./scenarios/ScenarioOneBaseline";
import ScenarioOneOptimized from "./scenarios/ScenarioOneOptimized";
import ScenarioTwoBaseline from "./scenarios/ScenarioTwoBaseline";
import ScenarioTwoOptimized from "./scenarios/ScenarioTwoOptimized";
import ScenarioThreeBaseline from "./scenarios/ScenarioThreeBaseline";
import ScenarioThreeOptimized from "./scenarios/ScenarioThreeOptimized";

type Scenario = "scenario1" | "scenario2" | "scenario3";
type Mode = "baseline" | "optimized";

function getSearchParamsState(): { scenario: Scenario; mode: Mode } {
  const params = new URLSearchParams(window.location.search);

  const scenarioParam = params.get("scenario");
  const modeParam = params.get("mode");

  const scenario: Scenario =
    scenarioParam === "scenario2"
      ? "scenario2"
      : scenarioParam === "scenario3"
        ? "scenario3"
        : "scenario1";

  const mode: Mode = modeParam === "optimized" ? "optimized" : "baseline";

  return { scenario, mode };
}

function updateSearchParams(scenario: Scenario, mode: Mode): void {
  const params = new URLSearchParams();
  params.set("scenario", scenario);
  params.set("mode", mode);

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", newUrl);
}

export default function App() {
  const { scenario, mode } = useMemo(() => getSearchParamsState(), []);

  function handleScenarioChange(nextScenario: Scenario) {
    updateSearchParams(nextScenario, mode);
    window.location.reload();
  }

  function handleModeChange(nextMode: Mode) {
    updateSearchParams(scenario, nextMode);
    window.location.reload();
  }

  return (
    <main className="page">
      <h1>React Rendering Experiment</h1>

      <div className="controls">
        <button
          className={scenario === "scenario1" ? "active" : ""}
          onClick={() => handleScenarioChange("scenario1")}
        >
          Scenario 1 - Memoization
        </button>

        <button
          className={scenario === "scenario2" ? "active" : ""}
          onClick={() => handleScenarioChange("scenario2")}
        >
          Scenario 2 - Virtualization
        </button>

        <button
          className={scenario === "scenario3" ? "active" : ""}
          onClick={() => handleScenarioChange("scenario3")}
        >
          Scenario 3 - Frequent updates
        </button>
      </div>

      <div className="controls">
        <button
          className={mode === "baseline" ? "active" : ""}
          onClick={() => handleModeChange("baseline")}
        >
          Baseline
        </button>

        <button
          className={mode === "optimized" ? "active" : ""}
          onClick={() => handleModeChange("optimized")}
        >
          Optimized
        </button>
      </div>

      {scenario === "scenario1" && mode === "baseline" && (
        <ScenarioOneBaseline />
      )}
      {scenario === "scenario1" && mode === "optimized" && (
        <ScenarioOneOptimized />
      )}
      {scenario === "scenario2" && mode === "baseline" && (
        <ScenarioTwoBaseline />
      )}
      {scenario === "scenario2" && mode === "optimized" && (
        <ScenarioTwoOptimized />
      )}
      {scenario === "scenario3" && mode === "baseline" && (
        <ScenarioThreeBaseline />
      )}
      {scenario === "scenario3" && mode === "optimized" && (
        <ScenarioThreeOptimized />
      )}
    </main>
  );
}
