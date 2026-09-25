import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calculator, Plus, Save, Trash2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { Card, PageHeader } from '../../../components/ui/misc';
import { Input, Select, Textarea } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState, PageLoader } from '../../../components/ui/States';
import { bomApi, materialsApi, productsApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import useMutationToast from '../../../hooks/useMutationToast';
import { money, number } from '../../../utils/format';

function BomEditor({ productId }) {
  const { can } = useAuth();
  const editable = can('bom:write');
  const bom = useQuery({ queryKey: ['bom', productId], queryFn: () => bomApi.get(productId) });
  const materials = useQuery({ queryKey: ['materials', 'all'], queryFn: () => materialsApi.list({ limit: 100 }).then((r) => r.items) });
  const [items, setItems] = useState([]);
  const [laborHours, setLaborHours] = useState(0);
  const [notes, setNotes] = useState('');
  const [qty, setQty] = useState(1);
  const calc = useQuery({ queryKey: ['bom-calc', productId, qty], queryFn: () => bomApi.calculate(productId, qty), enabled: Boolean(bom.data?.bom?.items?.length) });

  useEffect(() => {
    const b = bom.data?.bom;
    setItems((b?.items || []).map((i) => ({ material: i.material?._id, quantity: i.quantity, wastePercent: i.wastePercent || 0 })));
    setLaborHours(b?.laborHours || 0);
    setNotes(b?.notes || '');
  }, [bom.data]);

  const save = useMutationToast(() => bomApi.save(productId, { items: items.filter((i) => i.material).map((i) => ({ ...i, quantity: Number(i.quantity), wastePercent: Number(i.wastePercent) || 0 })), laborHours: Number(laborHours) || 0, notes }), {
    success: 'Bill of materials saved',
    invalidate: ['bom', 'bom-calc', 'boms'],
  });

  if (bom.isLoading) return <PageLoader />;
  const byId = new Map((materials.data || []).map((m) => [m._id, m]));
  const cost = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (1 + (Number(i.wastePercent) || 0) / 100) * (byId.get(i.material)?.unitCost || 0), 0);
  const productCost = bom.data?.product?.costPrice || 0;

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card
        title={`Materials per unit — ${bom.data?.product?.name}`}
        className="xl:col-span-2"
        padded={false}
        actions={editable && <Button size="sm" icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>}
      >
        <div className="divide-y divide-stone-100">
          {items.map((item, idx) => {
            const mat = byId.get(item.material);
            return (
              <div key={idx} className="grid gap-3 p-4 sm:grid-cols-[1fr_110px_100px_120px_auto] sm:items-end">
                <Select
                  label="Material"
                  placeholder="Choose material"
                  disabled={!editable}
                  value={item.material || ''}
                  onChange={(e) => setItems((l) => l.map((x, i) => (i === idx ? { ...x, material: e.target.value } : x)))}
                  options={(materials.data || []).map((m) => ({ value: m._id, label: `${m.name} (${m.unit})` }))}
                />
                <Input label={`Qty${mat ? ` (${mat.unit})` : ''}`} type="number" step="any" min="0" disabled={!editable} value={item.quantity} onChange={(e) => setItems((l) => l.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))} />
                <Input label="Waste %" type="number" min="0" max="100" disabled={!editable} value={item.wastePercent} onChange={(e) => setItems((l) => l.map((x, i) => (i === idx ? { ...x, wastePercent: e.target.value } : x)))} />
                <p className="pb-2 text-sm tabular-nums text-stone-600">{money((Number(item.quantity) || 0) * (1 + (Number(item.wastePercent) || 0) / 100) * (mat?.unitCost || 0))}</p>
                {editable && (
                  <button type="button" className="rounded p-2 text-stone-400 hover:text-red-600" onClick={() => setItems((l) => l.filter((_, i) => i !== idx))} aria-label="Remove material">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
          {!items.length && <p className="p-5 text-sm text-stone-500">No materials yet.</p>}
        </div>
        <div className="space-y-4 border-t border-stone-100 p-4">
          {editable && (
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setItems((l) => [...l, { material: '', quantity: 1, wastePercent: 0 }])}>
              Add material
            </Button>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Labour hours per unit" type="number" min="0" disabled={!editable} value={laborHours} onChange={(e) => setLaborHours(e.target.value)} />
            <Textarea label="Notes" rows={1} disabled={!editable} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <p className="text-sm">
            Material cost per unit: <strong>{money(cost)}</strong> · Recorded product cost: {money(productCost)}
            {cost > productCost && <Badge tone="red" className="ml-2">Materials exceed cost price</Badge>}
          </p>
        </div>
      </Card>
      <Card title="Production calculator" subtitle="What do we need to build N units?">
        <Input label="Units to build" type="number" min="1" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
        {calc.data && (
          <>
            <ul className="mt-4 divide-y divide-stone-100 text-sm">
              {calc.data.lines.map((l) => (
                <li key={l.material} className="flex justify-between py-2">
                  <span>
                    {l.name}
                    <span className="block text-xs text-stone-500">
                      need {number(l.required)} · have {number(l.available)} {l.unit}
                    </span>
                  </span>
                  {l.shortage > 0 ? <Badge tone="red">short {number(l.shortage)}</Badge> : <Badge tone="green">OK</Badge>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm">
              Total material cost: <strong>{money(calc.data.totalCost)}</strong>
            </p>
            <p className={`mt-1 text-sm font-medium ${calc.data.canProduce ? 'text-emerald-700' : 'text-red-600'}`}>{calc.data.canProduce ? 'Enough stock to produce' : 'Not enough stock — raise a purchase order'}</p>
          </>
        )}
        {!bom.data?.bom?.items?.length && <p className="mt-4 flex items-center gap-2 text-sm text-stone-500"><Calculator className="h-4 w-4" /> Save a bill of materials first.</p>}
      </Card>
    </div>
  );
}

export default function Bom() {
  const [params, setParams] = useSearchParams();
  const productId = params.get('product');
  const products = useQuery({ queryKey: ['products', 'bom-picker'], queryFn: () => productsApi.list({ limit: 100 }).then((r) => r.items) });
  const boms = useQuery({ queryKey: ['boms'], queryFn: bomApi.list });
  const withBom = new Set((boms.data || []).map((b) => String(b.product?._id)));

  return (
    <div className="space-y-6">
      <PageHeader title="Bill of materials" subtitle="Materials needed to build one unit of each product. Production jobs use these to calculate requirements." />
      <Select
        label="Product"
        placeholder="Choose a product"
        value={productId || ''}
        onChange={(e) => setParams(e.target.value ? { product: e.target.value } : {})}
        options={(products.data || []).map((p) => ({ value: p._id, label: `${p.name} (${p.sku})${withBom.has(String(p._id)) ? '' : ' — no BOM'}` }))}
        containerClassName="max-w-lg"
      />
      {productId ? <BomEditor key={productId} productId={productId} /> : <EmptyState title="Choose a product" message={`${withBom.size} of ${products.data?.length || 0} products have a bill of materials.`} />}
    </div>
  );
}
