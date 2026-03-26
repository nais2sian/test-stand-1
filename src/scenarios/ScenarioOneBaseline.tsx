// filtering and sorting are executed on every render
// even an unrelated state update triggered by a button recomputes filteredItems
// the ProductRow component is not memoized

import {
  Profiler,
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

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    performance.mark("baseline-input-start");
    setQuery(event.target.value);
  }

  const filteredItems = expensiveFilterAndSort(items, query);

  requestAnimationFrame(() => {
    performance.mark("baseline-next-paint");
    performance.measure(
      "baseline-input-to-next-paint",
      "baseline-input-start",
      "baseline-next-paint",
    );
  });

  return (
    <Profiler id="ScenarioOneBaseline" onRender={onRenderCallback}>
      <section>
        <h2>Scenario 1 - Baseline</h2>
        <p>
          No memoization for filtered data. Every render recomputes filtering
          and sorting.
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
