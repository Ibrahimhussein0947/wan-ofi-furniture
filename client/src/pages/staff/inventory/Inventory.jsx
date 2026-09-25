import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpDown, Boxes, Package } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import ExportMenu from '../../../components/ExportMenu';
import { FilterBar, PageHeader, StatCard, Tabs } from '../../../components/ui/misc';
import { Input, Select } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { QueryState } from '../../../components/ui/States';
import StockAdjustModal from './StockAdjustModal';
import { inventoryApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import useListParams from '../../../hooks/useListParams';
import { dateTime, label, money, number } from '../../../utils/format';

function Movements() {
  const [params, set] = useListParams();
  const query = useQuery({ queryKey: ['inventory', 'tx', params], queryFn: () => inventoryApi.transactions(params) });
  const columns = [
    { key: 'createdAt', header: 'Date', render: (t) => dateTime(t.createdAt), exportValue: (t) => dateTime(t.createdAt) },
    { key: 'item', header: 'Item', render: (t) => t.product?.name || t.material?.name, exportValue: (t) => t.product?.name || t.material?.name },
    { key: 'type', header: 'Type', render: (t) => <Badge>{label(t.type)}</Badge>, exportValue: (t) => label(t.type) },
    { key: 'quantity', header: 'Change', align: 'right', render: (t) => <span className={t.quantity < 0 ? 'text-red-600' : 'text-emerald-700'}>{t.quantity > 0 ? '+' : ''}{number(t.quantity)}</span> },
    { key: 'balanceAfter', header: 'Balance', align: 'right' },
    { key: 'referenceNumber', header: 'Reference', mobile: false },
    { key: 'note', header: 'Note', mobile: false, render: (t) => <span className="block max-w-xs truncate">{t.note}</span> },
    { key: 'createdBy', header: 'By', mobile: false, render: (t) => t.createdBy?.name, exportValue: (t) => t.createdBy?.name },
  ];
  return (
    <>
      <FilterBar>
        <Select value={params.itemType || ''} onChange={(e) => set({ itemType: e.target.value })} options={[{ value: 'PRODUCT', label: 'Products' }, { value: 'MATERIAL', label: 'Materials' }]} placeholder="All items" aria-label="Item type" containerClassName="sm:w-40" />
        <Select
          value={params.type || ''}
          onChange={(e) => set({ type: e.target.value })}
          options={['STOCK_IN', 'STOCK_OUT', 'DAMAGED', 'SALE', 'RETURN', 'PURCHASE_RECEIPT', 'PRODUCTION_ISSUE', 'PRODUCTION_RETURN', 'ADJUSTMENT'].map((t) => ({ value: t, label: label(t) }))}
          placeholder="All movements"
          aria-label="Movement type"
          containerClassName="sm:w-48"
        />
        <Input type="date" value={params.from || ''} onChange={(e) => set({ from: e.target.value })} aria-label="From" containerClassName="sm:w-40" />
        <Input type="date" value={params.to || ''} onChange={(e) => set({ to: e.target.value })} aria-label="To" containerClassName="sm:w-40" />
        <div className="sm:ml-auto">
          <ExportMenu filename="inventory-movements" title="Inventory movements" columns={columns} rows={query.data?.items} />
        </div>
      </FilterBar>
      <DataTable columns={columns} loading={query.isLoading} error={query.error} rows={query.data?.items} pagination={query.data?.pagination} onPageChange={(page) => set({ page })} dense />
    </>
  );
}

export default function Inventory() {
  const [tab, setTab] = useState('products');
  const [adjusting, setAdjusting] = useState(null);
  const { can } = useAuth();
  const query = useQuery({ queryKey: ['inventory', 'overview'], queryFn: inventoryApi.overview });
  const canAdjust = can('inventory:write');

  const adjustCol = (itemType) => ({
    key: 'actions',
    header: '',
    align: 'right',
    export: false,
    render: (row) =>
      canAdjust && (
        <Button size="sm" variant="secondary" icon={ArrowUpDown} onClick={(e) => { e.stopPropagation(); setAdjusting({ item: row, itemType }); }}>
          Adjust
        </Button>
      ),
  });

  const productCols = [
    { key: 'name', header: 'Product', render: (p) => <Link to={`/app/products/${p._id}`} className="font-medium hover:underline">{p.name}</Link>, exportValue: (p) => p.name },
    { key: 'sku', header: 'SKU', mobile: false },
    { key: 'quantity', header: 'In stock', align: 'right', render: (p) => <span className={p.isLowStock ? 'font-semibold text-red-600' : ''}>{p.quantity}</span> },
    { key: 'minStock', header: 'Min', align: 'right', mobile: false },
    { key: 'soldQuantity', header: 'Sold', align: 'right' },
    { key: 'damagedQuantity', header: 'Damaged', align: 'right', mobile: false },
    { key: 'stockValue', header: 'Value', align: 'right', render: (p) => money(p.stockValue) },
    { key: 'flags', header: '', export: false, render: (p) => (p.isLowStock ? <Badge tone="red">Low</Badge> : p.madeToOrder ? <Badge>MTO</Badge> : null) },
    adjustCol('PRODUCT'),
  ];
  const materialCols = [
    { key: 'name', header: 'Material', render: (m) => <Link to={`/app/materials/${m._id}`} className="font-medium hover:underline">{m.name}</Link>, exportValue: (m) => m.name },
    { key: 'category', header: 'Category', mobile: false, render: (m) => label(m.category) },
    { key: 'quantity', header: 'In stock', align: 'right', render: (m) => <span className={m.isLowStock ? 'font-semibold text-red-600' : ''}>{number(m.quantity)} {m.unit}</span>, exportValue: (m) => m.quantity },
    { key: 'minStock', header: 'Min', align: 'right', mobile: false },
    { key: 'unitCost', header: 'Unit cost', align: 'right', mobile: false, render: (m) => money(m.unitCost) },
    { key: 'stockValue', header: 'Value', align: 'right', render: (m) => money(m.stockValue) },
    { key: 'flags', header: '', export: false, render: (m) => m.isLowStock && <Badge tone="red">Low</Badge> },
    adjustCol('MATERIAL'),
  ];

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Finished furniture and raw materials. Every change is recorded." />
      <QueryState query={query}>
        {(d) => (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Finished goods value" value={money(d.totals.productValue)} icon={Package} />
              <StatCard label="Raw materials value" value={money(d.totals.materialValue)} icon={Boxes} tone="brass" />
              <StatCard label="Low-stock materials" value={d.totals.lowStockMaterials} icon={AlertTriangle} tone={d.totals.lowStockMaterials ? 'red' : 'green'} to="/app/materials?lowStock=true" />
              <StatCard label="Low-stock products" value={d.totals.lowStockProducts} icon={AlertTriangle} tone={d.totals.lowStockProducts ? 'red' : 'green'} />
            </div>
            <Tabs
              className="mb-4"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'products', label: 'Finished furniture', count: d.products.length },
                { value: 'materials', label: 'Raw materials', count: d.materials.length },
                { value: 'movements', label: 'Stock movements' },
              ]}
            />
            {tab === 'products' && (
              <>
                <div className="mb-3 flex justify-end">
                  <ExportMenu filename="finished-goods" title="Finished goods stock" columns={productCols} rows={d.products} />
                </div>
                <DataTable columns={productCols} rows={d.products} dense />
              </>
            )}
            {tab === 'materials' && (
              <>
                <div className="mb-3 flex justify-end">
                  <ExportMenu filename="materials-stock" title="Raw material stock" columns={materialCols} rows={d.materials} />
                </div>
                <DataTable columns={materialCols} rows={d.materials} dense />
              </>
            )}
            {tab === 'movements' && <Movements />}
          </>
        )}
      </QueryState>
      {adjusting && <StockAdjustModal open onClose={() => setAdjusting(null)} item={adjusting.item} itemType={adjusting.itemType} />}
    </div>
  );
}
