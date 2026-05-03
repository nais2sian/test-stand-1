// filtering and sorting are executed on every render
// even an unrelated state update triggered by a button recomputes filteredItems
// the ProductRow component is not memoized

import {
  Profiler,
  useEffect,
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

export default function ScenarioOneBaseline() {
  const [query, setQuery] = useState("");
  const [counter, setCounter] = useState(0);
  const [, forceUpdate] = useState(0);

  const shouldMeasureNextPaintRef = useRef(false);

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
    performance.mark("baseline-input-start");
    shouldMeasureNextPaintRef.current = true;
    setQuery(event.target.value);
  }

  function handleUnrelatedUpdate() {
    performance.mark("baseline-unrelated-start");
    shouldMeasureNextPaintRef.current = true;
    setCounter((value) => value + 1);
  }

  function handleResetCounter() {
    resetExpensiveCallCount();
    forceUpdate((value) => value + 1);
  }

  const filteredItems = expensiveFilterAndSort(items, query);

  useEffect(() => {
    if (!shouldMeasureNextPaintRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      if (performance.getEntriesByName("baseline-input-start").length > 0) {
        performance.mark("baseline-input-end");
        logMeasure(
          "baseline-input-to-next-paint",
          "baseline-input-start",
          "baseline-input-end",
        );
      }

      if (performance.getEntriesByName("baseline-unrelated-start").length > 0) {
        performance.mark("baseline-unrelated-end");
        logMeasure(
          "baseline-unrelated-update-to-next-paint",
          "baseline-unrelated-start",
          "baseline-unrelated-end",
        );
      }

      shouldMeasureNextPaintRef.current = false;
    });
  }, [query, counter]);

  return (
    <Profiler id="ScenarioOneBaseline" onRender={onRenderCallback}>
      <section data-testid="scenario1-baseline">
        <h2>Сценарий 1 - Базовый вариант</h2>
        <p>
          Фильтрация данных выполняется без мемоизации. При каждом рендере
          повторно выполняются фильтрация и сортировка.
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
