// filteredItems is wrapped in useMemo
// recalculation happens only when query changes
// the ProductRow component is wrapped in memo
// the input handler is wrapped in useCallback

import {
  memo,
  Profiler,
  useCallback,
  useMemo,
  useState,
  type ProfilerOnRenderCallback,
} from "react";
import { generateItems } from "../data";
import { expensiveFilterAndSort } from "../utils";

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

  const renderedAt = useMemo(
    () => performance.now().toFixed(2),
    [query, counter],
  );

  const onRenderCallback: ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
  ) => {
    console.log(`[Profiler][${id}] ${phase} duration:`, actualDuration);
  };

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      performance.mark("optimized-input-start");
      setQuery(event.target.value);
    },
    [],
  );

  const filteredItems = useMemo(() => {
    return expensiveFilterAndSort(items, query);
  }, [query]);

  requestAnimationFrame(() => {
    performance.mark("optimized-next-paint");
    performance.measure(
      "optimized-input-to-next-paint",
      "optimized-input-start",
      "optimized-next-paint",
    );
  });

  return (
    <Profiler id="ScenarioOneOptimized" onRender={onRenderCallback}>
      <section>
        <h2>Scenario 1 - Optimized</h2>
        <p>
          Filtering and sorting are memoized. Recalculation happens only when
          query changes.
        </p>

        <div className="controls">
          <input
            className="search"
            value={query}
            onChange={handleInputChange}
            placeholder="Type to filter 10,000 items"
          />
          <button onClick={() => setCounter((value) => value + 1)}>
            Unrelated state update: {counter}
          </button>
        </div>

        <p>Last render timestamp: {renderedAt}</p>
        <p>Visible items: {filteredItems.length}</p>

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
