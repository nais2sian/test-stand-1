export type ProductItem = {
  id: number;
  name: string;
  category: string;
  price: number;
  rating: number;
};

const categories = [
  "Books",
  "Electronics",
  "Clothes",
  "Sports",
  "Home",
  "Beauty",
];

export function generateItems(count: number): ProductItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Product ${index + 1}`,
    category: categories[index % categories.length],
    price: ((index * 17) % 500) + 10,
    rating: ((index * 13) % 5) + 1,
  }));
}