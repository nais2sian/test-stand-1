// the setup simulates a data-heavy ui with computationally expensive sampling

import type { ProductItem } from "./data";

export function expensiveFilterAndSort(
  items: ProductItem[],
  query: string
): ProductItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  let result = items;

  if (normalizedQuery) {
    result = items.filter((item) => {
      const target = `${item.name} ${item.category} ${item.price} ${item.rating}`.toLowerCase();

      return target.includes(normalizedQuery);
    });
  }

  // extra CPU work to make the difference measurable
  const cloned = [...result];

  for (let i = 0; i < 8; i += 1) {
    cloned.sort((a, b) => {
      const scoreA = a.price * a.rating + a.name.length;
      const scoreB = b.price * b.rating + b.name.length;
      return scoreA - scoreB;
    });
  }

  return cloned;
}