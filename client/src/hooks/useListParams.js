import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * List state (page, search, filters) kept in the URL so it survives reloads
 * and can be shared. Changing any filter resets to page 1.
 */
export default function useListParams(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => {
    const out = { page: 1, limit: 20, ...defaults };
    searchParams.forEach((value, key) => {
      out[key] = key === 'page' || key === 'limit' ? Number(value) : value;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const set = useCallback(
    (changes) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(changes).forEach(([k, v]) => {
            if (v === '' || v === undefined || v === null) next.delete(k);
            else next.set(k, String(v));
          });
          if (!('page' in changes)) next.delete('page');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return [params, set];
}
