import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Plus, Star } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import ExportMenu from '../../../components/ExportMenu';
import ProductImage from '../../../components/ProductImage';
import { FilterBar, PageHeader, SearchInput } from '../../../components/ui/misc';
import { Checkbox, Select } from '../../../components/ui/Field';
import { StatusBadge, Badge } from '../../../components/ui/Badge';
import { categoriesApi, productsApi } from '../../../api/endpoints';
import useListParams from '../../../hooks/useListParams';
import { PRODUCT_STATUSES } from '../../../utils/constants';
import { label, money } from '../../../utils/format';

export default function ProductList() {
  const [params, set] = useListParams();
  const navigate = useNavigate();
  const categories = useQuery({ queryKey: ['categories', 'staff'], queryFn: () => categoriesApi.list().then((r) => r.items) });
  const query = useQuery({ queryKey: ['products', 'staff', params], queryFn: () => productsApi.list(params), placeholderData: keepPreviousData });

  const columns = [
    {
      key: 'name',
      header: 'Product',
      render: (p) => (
        <span className="flex items-center gap-3">
          <ProductImage src={p.images?.[0]} name={p.name} className="h-10 w-10 shrink-0 rounded-lg" iconClassName="h-5 w-5" />
          <span>
            <span className="flex items-center gap-1 font-medium text-stone-900">
              {p.name} {p.isFeatured && <Star className="h-3.5 w-3.5 fill-brass-400 text-brass-400" aria-label="Featured" />}
            </span>
            <span className="text-xs text-stone-500">{p.sku}</span>
          </span>
        </span>
      ),
      exportValue: (p) => p.name,
    },
    { key: 'category', header: 'Category', render: (p) => p.category?.name, exportValue: (p) => p.category?.name },
    { key: 'costPrice', header: 'Cost', align: 'right', mobile: false, render: (p) => money(p.costPrice) },
    { key: 'sellingPrice', header: 'Price', align: 'right', render: (p) => money(p.sellingPrice) },
    {
      key: 'quantity',
      header: 'Stock',
      align: 'right',
      render: (p) => (
        <span className={p.isLowStock && !p.madeToOrder ? 'font-semibold text-red-600' : ''}>
          {p.quantity}
          {p.madeToOrder && <Badge className="ml-2">MTO</Badge>}
        </span>
      ),
    },
    { key: 'soldQuantity', header: 'Sold', align: 'right', mobile: false },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} />, exportValue: (p) => label(p.status) },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Catalog, pricing and finished-goods stock"
        actions={
          <>
            <ExportMenu filename="products" title="Products" columns={[...columns, { key: 'sku', header: 'SKU' }]} rows={query.data?.items} />
            <Button to="/app/products/new" icon={Plus}>
              New product
            </Button>
          </>
        }
      />
      <FilterBar>
        <SearchInput value={params.search} onChange={(search) => set({ search })} placeholder="Name or SKU…" className="sm:w-72" />
        <Select value={params.category || ''} onChange={(e) => set({ category: e.target.value })} options={(categories.data || []).map((c) => ({ value: c._id, label: c.name }))} placeholder="All categories" aria-label="Category" containerClassName="sm:w-48" />
        <Select value={params.status || ''} onChange={(e) => set({ status: e.target.value })} options={PRODUCT_STATUSES.map((s) => ({ value: s, label: label(s) }))} placeholder="Any status" aria-label="Status" containerClassName="sm:w-40" />
        <Checkbox label="Low stock" checked={params.lowStock === 'true'} onChange={(e) => set({ lowStock: e.target.checked ? 'true' : '' })} />
      </FilterBar>
      <DataTable
        columns={columns}
        loading={query.isLoading}
        error={query.error}
        rows={query.data?.items}
        pagination={query.data?.pagination}
        onPageChange={(page) => set({ page })}
        onRowClick={(p) => navigate(`/app/products/${p._id}`)}
      />
    </div>
  );
}
