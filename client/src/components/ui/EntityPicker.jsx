import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import { Field } from './Field';
import { useT } from '../../i18n/LanguageContext';

const LIST_HEIGHT = 300; // search box + a few options; decides whether the list opens upwards

/**
 * Searchable single-select backed by an API list endpoint.
 * `fetcher(search)` returns an array; `getLabel(item)` renders each option.
 * `onCreate(searchText)` adds a "Create …" row so a missing record can be added on the spot.
 * The list is drawn on top of the page (a portal), so cards with `overflow-hidden` can't clip it.
 */
export default function EntityPicker({ label, value, onChange, fetcher, queryKey, getLabel, getSubLabel, placeholder = 'Search…', error, required, disabled, hint, onCreate, createLabel }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const ref = useRef(null);
  const listRef = useRef(null);
  const [box, setBox] = useState(null);

  const place = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < LIST_HEIGHT && r.top > below;
    setBox({ left: r.left, width: r.width, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
  }, []);
  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && !listRef.current?.contains(e.target) && setOpen(false);
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
        {open &&
          box &&
          createPortal(
            <div ref={listRef} style={box} className="fixed z-[70] overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xl">
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
              {onCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onCreate(search.trim());
                    setSearch('');
                  }}
                  className="flex w-full items-center gap-2 border-t border-stone-100 px-3 py-2.5 text-left text-sm font-medium text-walnut-800 hover:bg-walnut-50"
                >
                  <Plus className="h-4 w-4" />
                  {search.trim() ? `${createLabel || t('Create')} “${search.trim()}”` : createLabel || t('Create new')}
                </button>
              )}
            </div>,
            document.body,
          )}
      </div>
    </Field>
  );
}
