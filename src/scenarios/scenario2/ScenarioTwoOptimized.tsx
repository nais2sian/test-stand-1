import {
  Profiler,
  useRef,
  useState,
  useEffect,
  useCallback,
  memo,
  type UIEvent,
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

const Row = memo(function Row({
  item,
  style,
}: {
  item: RowItem;
  style: React.CSSProperties;
}) {
  return (
    <div className="virtual-row virtual-absolute-row" style={style}>
      <span>{item.id}</span>
      <span>{item.title}</span>
      <span>{item.category}</span>
      <span>{item.price}</span>
      <span>{item.stock}</span>
    </div>
  );
});

export default function ScenarioTwoOptimized() {
  const [scrollTop, setScrollTop] = useState(0);
  const [paintCost, setPaintCost] = useState<string>("-");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    performance.mark("scenario2-scroll-start");
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  useEffect(() => {
    if (performance.getEntriesByName("scenario2-scroll-start").length === 0) {
      return;
    }

    requestAnimationFrame(() => {
      performance.mark("scenario2-scroll-end");

      try {
        performance.measure(
          "scenario2-scroll-to-next-paint",
          "scenario2-scroll-start",
          "scenario2-scroll-end",
        );

        const entries = performance.getEntriesByName(
          "scenario2-scroll-to-next-paint",
        );
        const lastEntry = entries[entries.length - 1];

        if (lastEntry) {
          const value = lastEntry.duration.toFixed(2);
          setPaintCost(value);
          console.log(`[measure] scenario2-scroll-to-next-paint: ${value} ms`);
        }

        performance.clearMarks("scenario2-scroll-start");
        performance.clearMarks("scenario2-scroll-end");
        performance.clearMeasures("scenario2-scroll-to-next-paint");
      } catch (error) {
        console.error("[measure] scenario2-scroll-to-next-paint failed", error);
      }
    });
  }, [scrollTop]);
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
          ref={scrollContainerRef}
          className="virtual-scroll-container"
          onScroll={handleScroll}
          data-testid="scenario2-scroll-container"
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
