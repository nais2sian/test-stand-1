// filteredItems is wrapped in useMemo
// recalculation happens only when query changes
// the ProductRow component is wrapped in memo
// the input handler is wrapped in useCallback

import {
  memo,
  Profiler,
  useCallback,
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

type ProductRowProps = {
  id: number;
  name: string;
  category: string;
  price: number;
  rating: number;
};

const ProductRow = memo(function ProductRow({
  id,
  name,
  category,
  price,
  rating,
}: ProductRowProps) {
  return (
    <div className="row">
      <span>{id}</span>
      <span>{name}</span>
      <span>{category}</span>
      <span>{price}</span>
      <span>{rating}</span>
    </div>
  );
});

export default function ScenarioOneOptimized() {
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

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      performance.mark("optimized-input-start");
      shouldMeasureNextPaintRef.current = true;
      setQuery(event.target.value);
    },
    [],
  );

  const handleUnrelatedUpdate = useCallback(() => {
    performance.mark("optimized-unrelated-start");
    shouldMeasureNextPaintRef.current = true;
    setCounter((value) => value + 1);
  }, []);

  const handleResetCounter = useCallback(() => {
    resetExpensiveCallCount();
    forceUpdate((value) => value + 1);
  }, []);

  const filteredItems = useMemo(() => {
    return expensiveFilterAndSort(items, query);
  }, [query]);

  useEffect(() => {
    if (!shouldMeasureNextPaintRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      if (performance.getEntriesByName("optimized-input-start").length > 0) {
        performance.mark("optimized-input-end");
        logMeasure(
          "optimized-input-to-next-paint",
          "optimized-input-start",
          "optimized-input-end",
        );
      }

      if (
        performance.getEntriesByName("optimized-unrelated-start").length > 0
      ) {
        performance.mark("optimized-unrelated-end");
        logMeasure(
          "optimized-unrelated-update-to-next-paint",
          "optimized-unrelated-start",
          "optimized-unrelated-end",
        );
      }

      shouldMeasureNextPaintRef.current = false;
    });
  }, [query, counter]);

  return (
    <Profiler id="ScenarioOneOptimized" onRender={onRenderCallback}>
      <section data-testid="scenario1-optimized">
        <h2>Scenario 1 - Optimized</h2>
        <p>
          Filtering and sorting are memoized. Recalculation happens only when
          query changes.
        </p>

        <div className="controls">
          <input
            data-testid="scenario1-input"
            className="search"
            value={query}
            onChange={handleInputChange}
            placeholder="Type to filter 10,000 items"
          />

          <button
            onClick={handleUnrelatedUpdate}
            data-testid="scenario1-unrelated-update"
          >
            Unrelated state update: {counter}
          </button>

          <button onClick={handleResetCounter}>
            Reset expensive call count
          </button>
        </div>

        <p>Visible items: {filteredItems.length}</p>
        <p data-testid="scenario1-expensive-call-count">
          expensiveFilterAndSort calls: {getExpensiveCallCount()}
        </p>
        <div className="table">
          <div className="row row-header">
            <span>ID</span>
            <span>Name</span>
            <span>Category</span>
            <span>Price</span>
            <span>Rating</span>
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
