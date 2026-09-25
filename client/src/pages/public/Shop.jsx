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

const SORTS = [
  { value: '', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most popular' },
  { value: 'price', label: 'Price: low to high' },
  { value: '-price', label: 'Price: high to low' },
  { value: 'name', label: 'Name A–Z' },
];
const COLORS = ['Walnut', 'Natural', 'Espresso', 'White', 'Grey', 'Black', 'Beige', 'Navy'];
const MATERIALS = ['Mahogany', 'Mninga', 'Pine', 'MDF', 'Fabric', 'Leather'];

export default function Shop() {
  const [params, set] = useListParams({ limit: 12 });
  const [showFilters, setShowFilters] = useState(false);
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.list().then((r) => r.items) });
  const products = useQuery({ queryKey: ['products', 'shop', params], queryFn: () => productsApi.list(params), placeholderData: keepPreviousData });

  const activeCategory = categories.data?.find((c) => c.slug === params.category);
  const hasFilters = ['category', 'color', 'material', 'minPrice', 'maxPrice', 'inStock', 'featured', 'search'].some((k) => params[k]);

  const filters = (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-walnut-950">Category</h3>
        <ul className="space-y-1">
          <li>
            <button type="button" onClick={() => set({ category: '' })} className={clsx('text-sm', !params.category ? 'font-semibold text-walnut-800' : 'text-stone-600 hover:text-walnut-800')}>
              All furniture
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
                  {c.name} <span className="text-stone-400">{c.productCount}</span>
                </button>
              </li>
            ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-walnut-950">Price</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" min="0" placeholder="Min" aria-label="Minimum price" defaultValue={params.minPrice} onBlur={(e) => set({ minPrice: e.target.value })} />
          <Input type="number" min="0" placeholder="Max" aria-label="Maximum price" defaultValue={params.maxPrice} onBlur={(e) => set({ maxPrice: e.target.value })} />
        </div>
      </div>
      <Select label="Colour" value={params.color || ''} onChange={(e) => set({ color: e.target.value })} options={COLORS} placeholder="Any colour" />
      <Select label="Material" value={params.material || ''} onChange={(e) => set({ material: e.target.value })} options={MATERIALS} placeholder="Any material" />
      <div className="space-y-2">
        <Checkbox label="In stock (ready to ship)" checked={params.inStock === 'true'} onChange={(e) => set({ inStock: e.target.checked ? 'true' : '' })} />
        <Checkbox label="Featured only" checked={params.featured === 'true'} onChange={(e) => set({ featured: e.target.checked ? 'true' : '' })} />
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" icon={X} onClick={() => set({ category: '', color: '', material: '', minPrice: '', maxPrice: '', inStock: '', featured: '', search: '' })}>
          Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="container-page py-10">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-semibold text-walnut-950">{activeCategory?.name || (params.featured ? 'Featured furniture' : 'Shop all furniture')}</h1>
        <p className="mt-2 text-stone-600">{activeCategory?.description || 'Handcrafted pieces, built in our workshop and delivered to your door.'}</p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={params.search} onChange={(search) => set({ search })} placeholder="Search furniture…" className="flex-1" />
        <div className="flex gap-2">
          <Select value={params.sort || ''} onChange={(e) => set({ sort: e.target.value })} options={SORTS} aria-label="Sort" containerClassName="flex-1 sm:w-52" />
          <Button variant="secondary" icon={SlidersHorizontal} className="lg:hidden" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            Filters
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className={clsx('rounded-2xl bg-white p-5 shadow-card lg:block lg:self-start', showFilters ? 'block' : 'hidden')} aria-label="Filters">
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
            <EmptyState title="No furniture matches your filters" message="Try widening your search — or ask us to build exactly what you want." action={<Button to="/custom-furniture">Request custom furniture</Button>} />
          )}
          {products.data?.items?.length > 0 && (
            <>
              <p className="mb-4 text-sm text-stone-500">{products.data.pagination.total} products</p>
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
