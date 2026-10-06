import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronDown, Search, X } from 'lucide-react';
import { Field } from './Field';
import { useT } from '../../i18n/LanguageContext';

/**
 * Searchable single-select backed by an API list endpoint.
 * `fetcher(search)` returns an array; `getLabel(item)` renders each option.
 */
export default function EntityPicker({ label, value, onChange, fetcher, queryKey, getLabel, getSubLabel, placeholder = 'Search…', error, required, disabled, hint }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const { data = [], isFetching } = useQuery({ queryKey: [queryKey, 'picker', debounced], queryFn: () => fetcher(debounced), enabled: open });

  return (
    <Field label={label} error={error} required={required} hint={hint}>
      <div className="relative" ref={ref}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={clsx('input flex items-center justify-between text-left', error && 'input-error', !value && 'text-stone-400')}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="truncate">{value ? getLabel(value) : placeholder}</span>
          <span className="flex items-center gap-1">
            {value && !disabled && (
              <X
                className="h-4 w-4 text-stone-400 hover:text-stone-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                aria-label={t('Clear')}
              />
            )}
            <ChevronDown className="h-4 w-4 text-stone-400" />
          </span>
        </button>
        {open && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xl">
            <div className="relative border-b border-stone-100 p-2">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} className="input h-9 pl-8" placeholder={t('Type to search…')} aria-label={t('Search')} />
            </div>
            <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
              {isFetching && !data.length && <li className="px-3 py-2 text-sm text-stone-500">{t('Searching…')}</li>}
              {!isFetching && !data.length && <li className="px-3 py-2 text-sm text-stone-500">{t('No matches')}</li>}
              {data.map((item) => (
                <li key={item._id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value?._id === item._id}
                    onClick={() => {
                      onChange(item);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={clsx('block w-full px-3 py-2 text-left text-sm hover:bg-walnut-50', value?._id === item._id && 'bg-walnut-50 font-medium')}
                  >
                    {getLabel(item)}
                    {getSubLabel && <span className="block text-xs text-stone-500">{getSubLabel(item)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Field>
  );
}
