import {
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

function Card({ item }: { item: MetricCard }) {
  return (
    <div className="metric-card">
      <div className="metric-card-title">{item.name}</div>
      <div>Значение: {item.value}</div>
      <div>Изменение: {item.change}</div>
      <div>Обновлено: {item.updatedAt}</div>
    </div>
  );
}

export default function ScenarioThreeBaseline() {
  const [cards, setCards] = useState<MetricCard[]>(() =>
    generateInitialCards(CARDS_COUNT),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [incomingUpdates, setIncomingUpdates] = useState(0);
  const [renderedUpdates, setRenderedUpdates] = useState(0);
  const [lastMeasure, setLastMeasure] = useState("-");
  const [runKey, setRunKey] = useState(0);

  const pendingMeasureIdRef = useRef<number | null>(null);
  const measureIdRef = useRef(0);

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
      const measureId = measureIdRef.current + 1;
      measureIdRef.current = measureId;
      pendingMeasureIdRef.current = measureId;

      performance.mark(`scenario3-baseline-update-start-${measureId}`);

      setCards((previous) => produceNextCards(previous));
      setIncomingUpdates((value) => value + 1);
      setRenderedUpdates((value) => value + 1);
    }, UPDATE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRunning, runKey]);

  useEffect(() => {
    const measureId = pendingMeasureIdRef.current;

    if (measureId === null) {
      return;
    }

    requestAnimationFrame(() => {
      if (measureId !== pendingMeasureIdRef.current) {
        return;
      }

      const startMark = `scenario3-baseline-update-start-${measureId}`;
      const endMark = `scenario3-baseline-update-end-${measureId}`;
      const measureName = "scenario3-baseline-update-to-next-paint";

      try {
        performance.mark(endMark);

        const measure = performance.measure(measureName, startMark, endMark);
        const duration = measure.duration.toFixed(2);

        setLastMeasure(duration);
        console.log(`[measure] ${measureName}: ${duration} ms`);
      } catch (error) {
        console.error(`[measure] ${measureName} failed`, error);
      } finally {
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(measureName);
        pendingMeasureIdRef.current = null;
      }
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
    pendingMeasureIdRef.current = null;
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
