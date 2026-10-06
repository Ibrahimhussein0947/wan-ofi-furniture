import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import clsx from 'clsx';
import { SlidersHorizontal, X } from 'lucide-react';
import ProductCard from '../../components/ProductCard';
import { SearchInput } from '../../components/ui/misc';
import { Select, Checkbox, Input } from '../../components/ui/Field';
import { Pagination } from '../../components/ui/DataTable';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import useListParams from '../../hooks/useListParams';
import { categoriesApi, productsApi } from '../../api/endpoints';
import { useT } from '../../i18n/LanguageContext';
import usePageMeta from '../../hooks/usePageMeta';

const SORTS = [
  { value: '', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most popular' },
  { value: 'price', label: 'Price: low to high' },
  { value: '-price', label: 'Price: high to low' },
  { value: 'name', label: 'Name A–Z' },
];
const COLORS = ['Walnut', 'Natural', 'Espresso', 'White', 'Grey', 'Black', 'Beige', 'Navy'];
const MATERIALS = ['Eucalyptus', 'Acacia', 'Pine', 'MDF', 'Fabric', 'Leather'];

export default function Shop() {
  const t = useT();
  const [params, set] = useListParams({ limit: 12 });
  const [showFilters, setShowFilters] = useState(false);
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.list().then((r) => r.items) });
  const products = useQuery({ queryKey: ['products', 'shop', params], queryFn: () => productsApi.list(params), placeholderData: keepPreviousData });

  const activeCategory = categories.data?.find((c) => c.slug === params.category);
  usePageMeta({
    title: activeCategory ? t(activeCategory.name) : t('Shop all furniture'),
    description: activeCategory?.description ? t(activeCategory.description) : t('Handcrafted pieces, built in our workshop and delivered to your door.'),
  });
  const hasFilters = ['category', 'color', 'material', 'minPrice', 'maxPrice', 'maxWidth', 'maxDepth', 'maxHeight', 'inStock', 'featured', 'search'].some((k) => params[k]);

  const filters = (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-walnut-950">{t('Category')}</h3>
        <ul className="space-y-1">
          <li>
            <button type="button" onClick={() => set({ category: '' })} className={clsx('text-sm', !params.category ? 'font-semibold text-walnut-800' : 'text-stone-600 hover:text-walnut-800')}>
              {t('All furniture')}
            </button>
          </li>
          {categories.data
            ?.filter((c) => c.productCount > 0)
            .map((c) => (
              <li key={c._id}>
                <button
                  type="button"
                  onClick={() => set({ category: c.slug })}
                  className={clsx('flex w-full justify-between text-sm', params.category === c.slug ? 'font-semibold text-walnut-800' : 'text-stone-600 hover:text-walnut-800')}
                >
                  {t(c.name)} <span className="text-stone-400">{c.productCount}</span>
                </button>
              </li>
            ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-walnut-950">{t('Price')}</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" min="0" placeholder={t('Min')} aria-label={t('Minimum price')} defaultValue={params.minPrice} onBlur={(e) => set({ minPrice: e.target.value })} />
          <Input type="number" min="0" placeholder={t('Max')} aria-label={t('Maximum price')} defaultValue={params.maxPrice} onBlur={(e) => set({ maxPrice: e.target.value })} />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-walnut-950">{t('Fits my space')}</h3>
        <p className="mb-2 text-xs text-stone-500">{t('Largest size that fits, in centimetres (3 m = 300).')}</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['maxWidth', 'Width'],
            ['maxDepth', 'Depth'],
            ['maxHeight', 'Height'],
          ].map(([key, text]) => (
            <Input
              key={`${key}-${params[key] || ''}`}
              type="number"
              min="1"
              label={t(text)}
              placeholder="cm"
              aria-label={t('Maximum {dimension} in cm', { dimension: t(text).toLowerCase() })}
              defaultValue={params[key]}
              onBlur={(e) => set({ [key]: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && set({ [key]: e.target.value })}
            />
          ))}
        </div>
      </div>
      <Select label={t('Colour')} value={params.color || ''} onChange={(e) => set({ color: e.target.value })} options={COLORS.map((c) => ({ value: c, label: t(c) }))} placeholder={t('Any colour')} />
      <Select label={t('Material')} value={params.material || ''} onChange={(e) => set({ material: e.target.value })} options={MATERIALS.map((m) => ({ value: m, label: t(m) }))} placeholder={t('Any material')} />
      <div className="space-y-2">
        <Checkbox label={t('In stock (ready to ship)')} checked={params.inStock === 'true'} onChange={(e) => set({ inStock: e.target.checked ? 'true' : '' })} />
        <Checkbox label={t('Featured only')} checked={params.featured === 'true'} onChange={(e) => set({ featured: e.target.checked ? 'true' : '' })} />
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" icon={X} onClick={() => set({ category: '', color: '', material: '', minPrice: '', maxPrice: '', maxWidth: '', maxDepth: '', maxHeight: '', inStock: '', featured: '', search: '' })}>
          {t('Clear filters')}
        </Button>
      )}
    </div>
  );

  return (
    <div className="container-page py-10">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-semibold text-walnut-950">{activeCategory ? t(activeCategory.name) : params.featured ? t('Featured furniture') : t('Shop all furniture')}</h1>
        <p className="mt-2 text-stone-600">{activeCategory?.description ? t(activeCategory.description) : t('Handcrafted pieces, built in our workshop and delivered to your door.')}</p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={params.search} onChange={(search) => set({ search })} placeholder={t('Search furniture…')} className="flex-1" />
        <div className="flex gap-2">
          <Select value={params.sort || ''} onChange={(e) => set({ sort: e.target.value })} options={SORTS.map((o) => ({ ...o, label: t(o.label) }))} aria-label={t('Sort')} containerClassName="flex-1 sm:w-52" />
          <Button variant="secondary" icon={SlidersHorizontal} className="lg:hidden" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            {t('Filters')}
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className={clsx('rounded-2xl bg-white p-5 shadow-card lg:block lg:self-start', showFilters ? 'block' : 'hidden')} aria-label={t('Filters')}>
          {filters}
        </aside>
        <div>
          {products.isLoading && (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
              ))}
            </div>
          )}
          {products.isError && <ErrorState error={products.error} onRetry={products.refetch} />}
          {products.data && !products.data.items.length && (
            <EmptyState title={t('No furniture matches your filters')} message="Try widening your search — or ask us to build exactly what you want." action={<Button to="/custom-furniture">{t('Request custom furniture')}</Button>} />
          )}
          {products.data?.items?.length > 0 && (
            <>
              <p className="mb-4 text-sm text-stone-500">{t('{count} products', { count: products.data.pagination.total })}</p>
              <div className={clsx('grid gap-6 sm:grid-cols-2 xl:grid-cols-3', products.isFetching && 'opacity-60')}>
                {products.data.items.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
              <div className="mt-8 overflow-hidden rounded-xl bg-white">
                <Pagination pagination={products.data.pagination} onPageChange={(page) => set({ page })} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
