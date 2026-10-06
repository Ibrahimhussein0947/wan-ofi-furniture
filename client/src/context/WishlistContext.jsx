import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { wishlistApi } from '../api/endpoints';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'wanofi.wishlist';
const WishlistContext = createContext({ ids: new Set(), count: 0, has: () => false, toggle: async () => {}, items: [], loading: false, isAccount: false });

function loadLocal() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveLocal(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable (private mode) — favourites last for this visit only.
  }
}

/**
 * Favourites live in the customer's account when signed in, and in the browser for
 * visitors. Browser favourites move into the account on the next customer login.
 */
export function WishlistProvider({ children }) {
  const { user, status } = useAuth();
  const queryClient = useQueryClient();
  const isAccount = user?.role === 'CUSTOMER';
  const [localIds, setLocalIds] = useState(loadLocal);
  const merged = useRef(null);

  const remote = useQuery({ queryKey: ['wishlist', user?._id], queryFn: wishlistApi.list, enabled: isAccount });

  // First load after a customer signs in: move browser favourites into the account.
  useEffect(() => {
    if (!isAccount || merged.current === user._id) return;
    merged.current = user._id;
    const pending = loadLocal();
    if (!pending.length) return;
    wishlistApi
      .merge(pending)
      .then((items) => {
        queryClient.setQueryData(['wishlist', user._id], items);
        saveLocal([]);
        setLocalIds([]);
      })
      .catch(() => {});
  }, [isAccount, user, queryClient]);

  const ids = useMemo(() => new Set(isAccount ? (remote.data || []).map((p) => p._id) : localIds), [isAccount, remote.data, localIds]);

  const toggle = useCallback(
    async (productId) => {
      const saved = ids.has(productId);
      if (isAccount) {
        const items = saved ? await wishlistApi.remove(productId) : await wishlistApi.add(productId);
        queryClient.setQueryData(['wishlist', user._id], items);
      } else {
        const next = saved ? localIds.filter((id) => id !== productId) : [productId, ...localIds.filter((id) => id !== productId)].slice(0, 200);
        setLocalIds(next);
        saveLocal(next);
      }
      return !saved;
    },
    [ids, isAccount, localIds, queryClient, user]
  );

  const value = useMemo(
    () => ({
      ids,
      count: ids.size,
      has: (id) => ids.has(id),
      toggle,
      isAccount,
      // Visitors' product details are loaded by the wishlist page itself.
      items: isAccount ? remote.data || [] : null,
      localIds,
      loading: status === 'loading' || (isAccount && remote.isLoading),
    }),
    [ids, toggle, isAccount, remote.data, remote.isLoading, localIds, status]
  );
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export const useWishlist = () => useContext(WishlistContext);
