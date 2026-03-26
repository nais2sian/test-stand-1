import { useState } from "react";
import ScenarioOneBaseline from "./scenarios/ScenarioOneBaseline";
import ScenarioOneOptimized from "./scenarios/ScenarioOneOptimized";

type Mode = "baseline" | "optimized";

export default function App() {
  const [mode, setMode] = useState<Mode>("baseline");

  return (
    <main className="page">
      <h1>React Rendering Experiment - Scenario 1</h1>

      <div className="controls">
        <button
          className={mode === "baseline" ? "active" : ""}
          onClick={() => setMode("baseline")}
        >
          Baseline
        </button>

        <button
          className={mode === "optimized" ? "active" : ""}
          onClick={() => setMode("optimized")}
        >
          Optimized
        </button>
      </div>

      {mode === "baseline" ? <ScenarioOneBaseline /> : <ScenarioOneOptimized />}
    </main>
  );
}
