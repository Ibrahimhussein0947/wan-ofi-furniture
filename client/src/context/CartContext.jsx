import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'wanofi.cart';

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const lineKey = (item) => `${item.productId}|${item.color || ''}|${item.size || ''}`;

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage unavailable (private mode) — the cart still works for this visit.
    }
  }, [items]);

  const value = useMemo(() => {
    const add = (product, { quantity = 1, color, size } = {}) =>
      setItems((current) => {
        const entry = {
          productId: product._id,
          slug: product.slug,
          name: product.name,
          image: product.images?.[0],
          price: product.sellingPrice,
          color,
          size,
          quantity,
        };
        const key = lineKey(entry);
        const existing = current.find((i) => lineKey(i) === key);
        if (existing) return current.map((i) => (lineKey(i) === key ? { ...i, quantity: Math.min(i.quantity + quantity, 99) } : i));
        return [...current, entry];
      });
    const update = (key, quantity) => setItems((current) => current.map((i) => (lineKey(i) === key ? { ...i, quantity: Math.max(1, Math.min(quantity, 99)) } : i)));
    const remove = (key) => setItems((current) => current.filter((i) => lineKey(i) !== key));
    const clear = () => setItems([]);
    return {
      items,
      add,
      update,
      remove,
      clear,
      lineKey,
      count: items.reduce((s, i) => s + i.quantity, 0),
      subtotal: items.reduce((s, i) => s + i.quantity * i.price, 0),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
