import type { ProductItem } from "./data";

let expensiveCallCount = 0;

export function resetExpensiveCallCount(): void {
  expensiveCallCount = 0;
}

export function getExpensiveCallCount(): number {
  return expensiveCallCount;
}

export function logMeasure(
  name: string,
  startMark: string,
  endMark: string
): void {
  try {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name);
    const lastEntry = entries[entries.length - 1];

    if (lastEntry) {
      console.log(`[measure] ${name}: ${lastEntry.duration.toFixed(2)} ms`);
    }

    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(name);
  } catch (error) {
    console.error(`[measure] failed for ${name}`, error);
  }
}

export function expensiveFilterAndSort(
  items: ProductItem[],
  query: string
): ProductItem[] {
  expensiveCallCount += 1;
  console.log(
    `[expensiveFilterAndSort] call: ${expensiveCallCount}, query: "${query}"`
  );

  const normalizedQuery = query.trim().toLowerCase();

  let result = items;

  if (normalizedQuery) {
    result = items.filter((item) => {
      const target =
        `${item.name} ${item.category} ${item.price} ${item.rating}`.toLowerCase();

      return target.includes(normalizedQuery);
    });
  }

  const cloned = [...result];

  // Artificial extra CPU work to make the difference measurable
  for (let i = 0; i < 8; i += 1) {
    cloned.sort((a, b) => {
      const scoreA = a.price * a.rating + a.name.length;
      const scoreB = b.price * b.rating + b.name.length;
      return scoreA - scoreB;
    });
  }

  return cloned;
}