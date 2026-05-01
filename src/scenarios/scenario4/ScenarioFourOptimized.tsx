import {
  memo,
  Profiler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ProfilerOnRenderCallback,
} from "react";

type SearchItem = {
  id: number;
  title: string;
  category: string;
  score: number;
  searchText: string;
};

const ITEMS_COUNT = 5000;
const AUTO_INPUT = "reactreact";
const AUTO_TYPE_INTERVAL_MS = 300;
const RENDER_WORK = 350;

function generateSearchItems(count: number): SearchItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    title: `Result ${index + 1}`,
    category: `Category ${(index % 20) + 1}`,
    score: (index * 17) % 100,
    searchText: `reactreact rendering performance concurrent item ${index + 1}`,
  }));
}

function filterItems(items: SearchItem[], query: string): SearchItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) => item.searchText.includes(normalizedQuery));
}

function simulateRenderWork(seed: number): string {
  let result = 0;

  for (let index = 0; index < RENDER_WORK; index += 1) {
    result += Math.sqrt(seed * index + 1) % 7;
  }

  return result.toFixed(2);
}

const items = generateSearchItems(ITEMS_COUNT);

const ResultCard = memo(function ResultCard({
  item,
  query,
}: {
  item: SearchItem;
  query: string;
}) {
  const checksum = simulateRenderWork(item.id + query.length);

  return (
    <div className="search-card">
      <div className="search-card-title">{item.title}</div>
      <div>Category: {item.category}</div>
      <div>Score: {item.score}</div>
      <div>Query length: {query.length}</div>
      <div>Render checksum: {checksum}</div>
    </div>
  );
});

const ResultsGrid = memo(function ResultsGrid({
  results,
  query,
}: {
  results: SearchItem[];
  query: string;
}) {
  return (
    <div className="search-grid">
      {results.map((item) => (
        <ResultCard key={item.id} item={item} query={query} />
      ))}
    </div>
  );
});

export default function ScenarioFourOptimized() {
  const [inputValue, setInputValue] = useState("");
  const [resultQuery, setResultQuery] = useState("");
  const [typedCharacters, setTypedCharacters] = useState(0);
  const [lastMeasure, setLastMeasure] = useState("-");
  const [isAutoTyping, setIsAutoTyping] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeMeasureRef = useRef<{
    startMark: string;
    endMark: string;
    measureName: string;
  } | null>(null);
  const measureIdRef = useRef(0);

  const results = useMemo(() => filterItems(items, resultQuery), [resultQuery]);

  const onRenderCallback: ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
  ) => {
    console.log(
      `[Profiler][${id}] ${phase} duration: ${actualDuration.toFixed(2)} ms`,
    );
  };

  const startInputMeasure = useCallback(() => {
    measureIdRef.current += 1;

    const measureId = measureIdRef.current;
    const startMark = `scenario4-optimized-input-start-${measureId}`;
    const endMark = `scenario4-optimized-input-end-${measureId}`;
    const measureName = `scenario4-optimized-input-to-next-paint-${measureId}`;

    activeMeasureRef.current = {
      startMark,
      endMark,
      measureName,
    };

    performance.mark(startMark);
  }, []);

  const applyInputValue = useCallback(
    (nextValue: string) => {
      startInputMeasure();

      setInputValue(nextValue);
      setTypedCharacters(nextValue.length);

      startTransition(() => {
        setResultQuery(nextValue);
      });
    },
    [startInputMeasure, startTransition],
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      applyInputValue(event.target.value);
    },
    [applyInputValue],
  );

  const handleRunAutoInput = useCallback(() => {
    setInputValue("");
    setResultQuery("");
    setTypedCharacters(0);
    setLastMeasure("-");
    setIsAutoTyping(true);
  }, []);

  const handleReset = useCallback(() => {
    setIsAutoTyping(false);
    setInputValue("");
    setResultQuery("");
    setTypedCharacters(0);
    setLastMeasure("-");
    activeMeasureRef.current = null;
  }, []);

  useEffect(() => {
    if (!isAutoTyping) {
      return;
    }

    let currentIndex = 0;

    const intervalId = window.setInterval(() => {
      const nextValue = AUTO_INPUT.slice(0, currentIndex + 1);
      applyInputValue(nextValue);

      currentIndex += 1;

      if (currentIndex >= AUTO_INPUT.length) {
        window.clearInterval(intervalId);
        setIsAutoTyping(false);
      }
    }, AUTO_TYPE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isAutoTyping, applyInputValue]);

  useEffect(() => {
    const activeMeasure = activeMeasureRef.current;

    if (!activeMeasure) {
      return;
    }

    requestAnimationFrame(() => {
      try {
        performance.mark(activeMeasure.endMark);
        performance.measure(
          activeMeasure.measureName,
          activeMeasure.startMark,
          activeMeasure.endMark,
        );

        const entries = performance.getEntriesByName(activeMeasure.measureName);
        const lastEntry = entries[entries.length - 1];

        if (lastEntry) {
          const duration = lastEntry.duration.toFixed(2);
          setLastMeasure(duration);

          console.log(
            `[measure] scenario4-optimized-input-to-next-paint: ${duration} ms`,
          );
        }

        performance.clearMarks(activeMeasure.startMark);
        performance.clearMarks(activeMeasure.endMark);
        performance.clearMeasures(activeMeasure.measureName);
      } catch (error) {
        console.error(
          "[measure] scenario4-optimized-input-to-next-paint failed",
          error,
        );
      }

      activeMeasureRef.current = null;
    });
  }, [inputValue]);

  return (
    <Profiler id="ScenarioFourOptimized" onRender={onRenderCallback}>
      <section data-testid="scenario4-optimized">
        <h2>Scenario 4 - Optimized</h2>
        <p>
          The input value is updated urgently, while the heavy list update is
          scheduled as a transition.
        </p>

        <div className="controls">
          <button onClick={handleRunAutoInput} disabled={isAutoTyping}>
            Run auto input
          </button>
          <button onClick={handleReset}>Reset</button>
        </div>

        <label className="search-label" htmlFor="scenario4-optimized-input">
          Search query
        </label>
        <input
          data-testid="scenario4-input"
          id="scenario4-optimized-input"
          className="search-input"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Type reactreact"
        />

        <p>Auto typing: {isAutoTyping ? "Yes" : "No"}</p>
        <p>Transition pending: {isPending ? "Yes" : "No"}</p>
        <p>Typed characters: {typedCharacters}</p>
        <p>Input value: {inputValue || "-"}</p>
        <p>List query: {resultQuery || "-"}</p>
        <p>Rendered results: {results.length}</p>
        <p>Last input-to-next-paint: {lastMeasure} ms</p>

        <ResultsGrid results={results} query={resultQuery} />
      </section>
    </Profiler>
  );
}
