// filteredItems is wrapped in useMemo.
// Recalculation happens only when query changes.
// ProductRow and event handlers are intentionally left non-memoized
// to isolate the effect of useMemo.

import {
  Profiler,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ProfilerOnRenderCallback,
} from "react";
import { generateItems } from "../../data";
import {
  expensiveFilterAndSort,
  getExpensiveCallCount,
  logMeasure,
  resetExpensiveCallCount,
} from "../../utils";

const ITEMS_COUNT = 10000;
const items = generateItems(ITEMS_COUNT);

type MeasureType = "input" | "unrelated";

type ProductRowProps = {
  id: number;
  name: string;
  category: string;
  price: number;
  rating: number;
};

function ProductRow({ id, name, category, price, rating }: ProductRowProps) {
  return (
    <div className="row">
      <span>{id}</span>
      <span>{name}</span>
      <span>{category}</span>
      <span>{price}</span>
      <span>{rating}</span>
    </div>
  );
}

export default function ScenarioOneOptimized() {
  const [query, setQuery] = useState("");
  const [counter, setCounter] = useState(0);
  const [, forceUpdate] = useState(0);

  const pendingMeasureRef = useRef<MeasureType | null>(null);

  const onRenderCallback: ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
  ) => {
    console.log(
      `[Profiler][${id}] ${phase} duration: ${actualDuration.toFixed(2)} ms`,
    );
  };

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    performance.mark("optimized-input-start");
    pendingMeasureRef.current = "input";
    setQuery(event.target.value);
  }

  function handleUnrelatedUpdate() {
    performance.mark("optimized-unrelated-start");
    pendingMeasureRef.current = "unrelated";
    setCounter((value) => value + 1);
  }

  function handleResetCounter() {
    resetExpensiveCallCount();
    forceUpdate((value) => value + 1);
  }

  const filteredItems = useMemo(() => {
    return expensiveFilterAndSort(items, query);
  }, [query]);

  useEffect(() => {
    const measureType = pendingMeasureRef.current;

    if (measureType === null) {
      return;
    }

    requestAnimationFrame(() => {
      if (measureType === "input") {
        performance.mark("optimized-input-end");
        logMeasure(
          "optimized-input-to-next-paint",
          "optimized-input-start",
          "optimized-input-end",
        );
      }

      if (measureType === "unrelated") {
        performance.mark("optimized-unrelated-end");
        logMeasure(
          "optimized-unrelated-update-to-next-paint",
          "optimized-unrelated-start",
          "optimized-unrelated-end",
        );
      }

      pendingMeasureRef.current = null;
    });
  }, [query, counter]);

  return (
    <Profiler id="ScenarioOneOptimized" onRender={onRenderCallback}>
      <section data-testid="scenario1-optimized">
        <h2>Сценарий 1 - Оптимизированный вариант</h2>
        <p>
          Фильтрация и сортировка данных мемоизированы. Повторное вычисление
          выполняется только при изменении поискового запроса.
        </p>

        <div className="controls">
          <input
            data-testid="scenario1-input"
            className="search"
            value={query}
            onChange={handleInputChange}
            placeholder="Введите текст для фильтрации 10 000 элементов"
          />

          <button
            onClick={handleUnrelatedUpdate}
            data-testid="scenario1-unrelated-update"
          >
            Обновление несвязанного состояния: {counter}
          </button>

          <button onClick={handleResetCounter}>
            Сбросить счетчик вычислений
          </button>
        </div>

        <p>Отображаемые элементы: {filteredItems.length}</p>
        <p data-testid="scenario1-expensive-call-count">
          Вызовы expensiveFilterAndSort: {getExpensiveCallCount()}
        </p>

        <div className="table">
          <div className="row row-header">
            <span>ID</span>
            <span>Название</span>
            <span>Категория</span>
            <span>Цена</span>
            <span>Рейтинг</span>
          </div>

          {filteredItems.slice(0, 300).map((item) => (
            <ProductRow
              key={item.id}
              id={item.id}
              name={item.name}
              category={item.category}
              price={item.price}
              rating={item.rating}
            />
          ))}
        </div>
      </section>
    </Profiler>
  );
}
