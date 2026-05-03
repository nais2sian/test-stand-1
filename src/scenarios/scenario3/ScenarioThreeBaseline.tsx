import {
  memo,
  Profiler,
  useEffect,
  useRef,
  useState,
  type ProfilerOnRenderCallback,
} from "react";

type MetricCard = {
  id: number;
  name: string;
  value: number;
  change: number;
  updatedAt: number;
};

const CARDS_COUNT = 200;
const UPDATE_INTERVAL_MS = 50;

function generateInitialCards(count: number): MetricCard[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Метрика ${index + 1}`,
    value: 100 + ((index * 17) % 100),
    change: 0,
    updatedAt: Date.now(),
  }));
}

function produceNextCards(previous: MetricCard[]): MetricCard[] {
  const now = Date.now();

  return previous.map((card, index) => {
    const delta = ((index * 13 + now) % 7) - 3;

    return {
      ...card,
      value: card.value + delta,
      change: delta,
      updatedAt: now,
    };
  });
}

const Card = memo(function Card({ item }: { item: MetricCard }) {
  return (
    <div className="metric-card">
      <div className="metric-card-title">{item.name}</div>
      <div>Значение: {item.value}</div>
      <div>Изменение: {item.change}</div>
      <div>Обновлено: {item.updatedAt}</div>
    </div>
  );
});

export default function ScenarioThreeBaseline() {
  const [cards, setCards] = useState<MetricCard[]>(() =>
    generateInitialCards(CARDS_COUNT),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [incomingUpdates, setIncomingUpdates] = useState(0);
  const [renderedUpdates, setRenderedUpdates] = useState(0);
  const [lastMeasure, setLastMeasure] = useState("-");
  const [runKey, setRunKey] = useState(0);

  const shouldMeasureRef = useRef(false);

  const onRenderCallback: ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
  ) => {
    console.log(
      `[Profiler][${id}] ${phase} duration: ${actualDuration.toFixed(2)} ms`,
    );
  };

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      performance.mark("scenario3-baseline-update-start");
      shouldMeasureRef.current = true;

      setCards((previous) => produceNextCards(previous));
      setIncomingUpdates((value) => value + 1);
      setRenderedUpdates((value) => value + 1);
    }, UPDATE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRunning, runKey]);

  useEffect(() => {
    if (!shouldMeasureRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      try {
        performance.mark("scenario3-baseline-update-end");
        performance.measure(
          "scenario3-baseline-update-to-next-paint",
          "scenario3-baseline-update-start",
          "scenario3-baseline-update-end",
        );

        const entries = performance.getEntriesByName(
          "scenario3-baseline-update-to-next-paint",
        );
        const lastEntry = entries[entries.length - 1];

        if (lastEntry) {
          const duration = lastEntry.duration.toFixed(2);
          setLastMeasure(duration);
          console.log(
            `[measure] scenario3-baseline-update-to-next-paint: ${duration} ms`,
          );
        }

        performance.clearMarks("scenario3-baseline-update-start");
        performance.clearMarks("scenario3-baseline-update-end");
        performance.clearMeasures("scenario3-baseline-update-to-next-paint");
      } catch (error) {
        console.error(
          "[measure] scenario3-baseline-update-to-next-paint failed",
          error,
        );
      }

      shouldMeasureRef.current = false;
    });
  }, [cards]);

  function handleStart() {
    setIsRunning(true);
  }

  function handleStop() {
    setIsRunning(false);
  }

  function handleReset() {
    setIsRunning(false);
    setCards(generateInitialCards(CARDS_COUNT));
    setIncomingUpdates(0);
    setRenderedUpdates(0);
    setLastMeasure("-");
    setRunKey((value) => value + 1);
  }

  return (
    <Profiler id="ScenarioThreeBaseline" onRender={onRenderCallback}>
      <section data-testid="scenario3-baseline">
        <h2>Сценарий 3 - Базовый вариант</h2>
        <p>
          Высокочастотные обновления. Интерфейс повторно рендерится при каждом
          входящем обновлении - каждые 50 мс.
        </p>

        <div className="controls">
          <button data-testid="scenario3-start" onClick={handleStart}>
            Запустить
          </button>
          <button data-testid="scenario3-stop" onClick={handleStop}>
            Остановить
          </button>
          <button data-testid="scenario3-reset" onClick={handleReset}>
            Сбросить
          </button>
        </div>

        <p data-testid="scenario3-running">
          Выполняется: {isRunning ? "Да" : "Нет"}
        </p>
        <p data-testid="scenario3-incoming-updates">
          Входящие обновления: {incomingUpdates}
        </p>
        <p data-testid="scenario3-rendered-updates">
          Отрендеренные обновления: {renderedUpdates}
        </p>
        <p data-testid="scenario3-last-measure">
          Последнее время от обновления до следующей отрисовки: {lastMeasure} мс
        </p>
        <p>Всего карточек: {cards.length}</p>

        <div className="metrics-grid">
          {cards.map((item) => (
            <Card key={item.id} item={item} />
          ))}
        </div>
      </section>
    </Profiler>
  );
}
