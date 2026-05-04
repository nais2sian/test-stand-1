import {
  Profiler,
  useRef,
  useState,
  type CSSProperties,
  type ProfilerOnRenderCallback,
  type UIEvent,
} from "react";

type RowItem = {
  id: number;
  title: string;
  category: string;
  price: number;
  stock: number;
};

const ROWS_COUNT = 10000;
const ROW_HEIGHT = 44;
const CONTAINER_HEIGHT = 500;
const OVERSCAN = 8;

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

function Row({ item, style }: { item: RowItem; style: CSSProperties }) {
  return (
    <div className="virtual-row virtual-absolute-row" style={style}>
      <span>{item.id}</span>
      <span>{item.title}</span>
      <span>{item.category}</span>
      <span>{item.price}</span>
      <span>{item.stock}</span>
    </div>
  );
}

export default function ScenarioTwoOptimized() {
  const [scrollTop, setScrollTop] = useState(0);
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

  const totalHeight = rows.length * ROW_HEIGHT;

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    rows.length,
    Math.ceil((scrollTop + CONTAINER_HEIGHT) / ROW_HEIGHT) + OVERSCAN,
  );

  const visibleRows = rows.slice(startIndex, endIndex);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const measureId = scrollMeasureIdRef.current + 1;
    scrollMeasureIdRef.current = measureId;

    const startMark = `scenario2-optimized-scroll-start-${measureId}`;
    const endMark = `scenario2-optimized-scroll-end-${measureId}`;
    const measureName = "scenario2-optimized-scroll-to-next-paint";

    performance.mark(startMark);
    setScrollTop(event.currentTarget.scrollTop);

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
    <Profiler id="ScenarioTwoOptimized" onRender={onRenderCallback}>
      <section data-testid="scenario2-optimized">
        <h2>Сценарий 2 - Оптимизированный вариант</h2>
        <p>
          Ручная виртуализация. В DOM монтируются только видимые строки и
          небольшой буфер дополнительных строк.
        </p>

        <p>Всего строк: {rows.length}</p>
        <p>Видимых строк в DOM: {visibleRows.length}</p>
        <p>
          Последнее время от прокрутки до следующей отрисовки: {paintCost} мс
        </p>

        <div className="virtual-table-header">
          <div className="virtual-row virtual-header">
            <span>ID</span>
            <span>Название</span>
            <span>Категория</span>
            <span>Цена</span>
            <span>Остаток</span>
          </div>
        </div>

        <div
          className="virtual-scroll-container"
          data-testid="scenario2-scroll-container"
          onScroll={handleScroll}
        >
          <div className="virtual-inner" style={{ height: `${totalHeight}px` }}>
            {visibleRows.map((item, index) => {
              const actualIndex = startIndex + index;

              return (
                <Row
                  key={item.id}
                  item={item}
                  style={{
                    top: `${actualIndex * ROW_HEIGHT}px`,
                    height: `${ROW_HEIGHT}px`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </section>
    </Profiler>
  );
}
