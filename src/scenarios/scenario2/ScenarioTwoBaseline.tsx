import {
  Profiler,
  useRef,
  useState,
  type ProfilerOnRenderCallback,
} from "react";

type RowItem = {
  id: number;
  title: string;
  category: string;
  price: number;
  stock: number;
};

const ROWS_COUNT = 10000;

function generateRows(count: number): RowItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    title: `Item ${index + 1}`,
    category: `Category ${(index % 20) + 1}`,
    price: ((index * 13) % 1000) + 10,
    stock: (index * 7) % 300,
  }));
}

const rows = generateRows(ROWS_COUNT);

function Row({ item }: { item: RowItem }) {
  return (
    <div className="virtual-row">
      <span>{item.id}</span>
      <span>{item.title}</span>
      <span>{item.category}</span>
      <span>{item.price}</span>
      <span>{item.stock}</span>
    </div>
  );
}

export default function ScenarioTwoBaseline() {
  const [paintCost, setPaintCost] = useState<string>("-");
  const scrollMeasureIdRef = useRef(0);

  const onRenderCallback: ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
  ) => {
    console.log(
      `[Profiler][${id}] ${phase} duration: ${actualDuration.toFixed(2)} ms`,
    );
  };

  function handleScroll() {
    const measureId = scrollMeasureIdRef.current + 1;
    scrollMeasureIdRef.current = measureId;

    const startMark = `scenario2-baseline-scroll-start-${measureId}`;
    const endMark = `scenario2-baseline-scroll-end-${measureId}`;
    const measureName = "scenario2-baseline-scroll-to-next-paint";

    performance.mark(startMark);

    requestAnimationFrame(() => {
      if (measureId !== scrollMeasureIdRef.current) {
        return;
      }

      performance.mark(endMark);

      try {
        const measure = performance.measure(measureName, startMark, endMark);
        const value = measure.duration.toFixed(2);

        setPaintCost(value);
        console.log(`[measure] ${measureName}: ${value} ms`);
      } catch (error) {
        console.error(`[measure] ${measureName} failed`, error);
      } finally {
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(measureName);
      }
    });
  }

  return (
    <Profiler id="ScenarioTwoBaseline" onRender={onRenderCallback}>
      <section data-testid="scenario2-baseline">
        <h2>Сценарий 2 - Базовый вариант</h2>
        <p>
          Полный рендеринг большого списка. Все 10 000 строк монтируются в DOM.
        </p>

        <p>Всего строк: {rows.length}</p>
        <p>Строк в DOM: {rows.length}</p>
        <p>
          Последнее время от прокрутки до следующей отрисовки: {paintCost} мс
        </p>

        <div
          className="virtual-table baseline-table"
          data-testid="scenario2-baseline-table"
          onScroll={handleScroll}
        >
          <div className="virtual-row virtual-header">
            <span>ID</span>
            <span>Название</span>
            <span>Категория</span>
            <span>Цена</span>
            <span>Остаток</span>
          </div>

          {rows.map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </div>
      </section>
    </Profiler>
  );
}
