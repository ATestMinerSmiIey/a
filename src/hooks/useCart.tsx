import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";

export type CartItem = {
  listing_id: string;
  name: string;
  price: number;
  image: string;
  ships_from: string;
  quantity: number;
  flavor?: string;
};

type CartContextValue = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQuantity: (listing_id: string, qty: number, flavor?: string) => void;
  remove: (listing_id: string, flavor?: string) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "cart.v1";

// Generate a unique key for cart items (listing_id + flavor combo)
const getItemKey = (listing_id: string, flavor?: string) => 
  flavor ? `${listing_id}::${flavor}` : listing_id;

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    add: (item, qty = 1) =>
      setItems((curr) => {
        const safeQty = Math.min(Math.max(1, qty), 9999);
        // Match by listing_id AND flavor to allow same product with different flavors
        const existing = curr.find(
          (c) => c.listing_id === item.listing_id && c.flavor === item.flavor
        );
        if (existing) {
          return curr.map((c) =>
            c.listing_id === item.listing_id && c.flavor === item.flavor
              ? { ...c, quantity: Math.min(c.quantity + safeQty, 9999) }
              : c,
          );
        }
        return [...curr, { ...item, quantity: safeQty }];
      }),
    setQuantity: (listing_id, qty, flavor) =>
      setItems((curr) =>
        qty <= 0
          ? curr.filter((c) => !(c.listing_id === listing_id && c.flavor === flavor))
          : curr.map((c) => 
              c.listing_id === listing_id && c.flavor === flavor 
                ? { ...c, quantity: Math.min(qty, 9999) } 
                : c
            ),
      ),
    remove: (listing_id, flavor) => 
      setItems((curr) => curr.filter((c) => !(c.listing_id === listing_id && c.flavor === flavor))),
    clear: () => setItems([]),
    total: items.reduce((s, i) => s + i.price * i.quantity, 0),
    count: items.reduce((s, i) => s + i.quantity, 0),
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};