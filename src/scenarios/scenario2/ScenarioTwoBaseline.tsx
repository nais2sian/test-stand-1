import { Profiler, type ProfilerOnRenderCallback } from "react";

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
  const onRenderCallback: ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
  ) => {
    console.log(
      `[Profiler][${id}] ${phase} duration: ${actualDuration.toFixed(2)} ms`,
    );
  };

  return (
    <Profiler id="ScenarioTwoBaseline" onRender={onRenderCallback}>
      <section>
        <h2>Scenario 2 - Baseline</h2>
        <p>
          Full rendering of a large list. All 10,000 rows are mounted into the
          DOM.
        </p>

        <p>Total rows: {rows.length}</p>

        <div className="virtual-table baseline-table">
          <div className="virtual-row virtual-header">
            <span>ID</span>
            <span>Title</span>
            <span>Category</span>
            <span>Price</span>
            <span>Stock</span>
          </div>

          {rows.map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </div>
      </section>
    </Profiler>
  );
}
