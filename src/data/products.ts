export type Product = {
  id: string;
  name: string;
  price: number;
  priceCrypto: { xmr: string };
  image: string;
  rating: number;
  reviews: number;
  seller: string;
  description: string;
  stock: number;
};

// No public listings yet — products will be added by the owner via the dashboard.
export const products: Product[] = [];
