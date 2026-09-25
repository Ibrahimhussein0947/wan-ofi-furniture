import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Input, Select, Textarea } from '../../../components/ui/Field';
import { materialsApi, purchasesApi, suppliersApi } from '../../../api/endpoints';
import useMutationToast from '../../../hooks/useMutationToast';
import { money } from '../../../utils/format';

export default function PurchaseOrderModal({ open, onClose, supplier: fixedSupplier, presetMaterial }) {
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(fixedSupplier?._id || '');
  const [lines, setLines] = useState([{ material: presetMaterial || '', quantity: 1, unitCost: 0 }]);
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const suppliers = useQuery({ queryKey: ['suppliers', 'all'], queryFn: () => suppliersApi.list({ limit: 100 }).then((r) => r.items), enabled: open && !fixedSupplier });
  const materials = useQuery({ queryKey: ['materials', 'all'], queryFn: () => materialsApi.list({ limit: 100 }).then((r) => r.items), enabled: open });

  useEffect(() => {
    if (open) {
      setSupplier(fixedSupplier?._id || '');
      setLines([{ material: presetMaterial || '', quantity: 1, unitCost: 0 }]);
    }
  }, [open, fixedSupplier, presetMaterial]);

  const byId = new Map((materials.data || []).map((m) => [m._id, m]));
  const total = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitCost || 0), 0);
  const create = useMutationToast((body) => purchasesApi.create(body), {
    success: (po) => `Purchase order ${po.poNumber} created`,
    invalidate: ['purchases', 'supplier'],
    onSuccess: (po) => {
      onClose();
      navigate(`/app/purchases/${po._id}`);
    },
  });

  const submit = (status) => {
    const items = lines.filter((l) => l.material && Number(l.quantity) > 0).map((l) => ({ material: l.material, quantity: Number(l.quantity), unitCost: Number(l.unitCost) || 0 }));
    if (!supplier) return toast.error('Choose a supplier.');
    if (!items.length) return toast.error('Add at least one material.');
    return create.mutate({ supplier, items, expectedDate: expectedDate || undefined, notes, status });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New purchase order"
      size="xl"
      footer={
        <>
          <Button variant="secondary" loading={create.isPending && create.variables?.status === 'DRAFT'} onClick={() => submit('DRAFT')}>
            Save as draft
          </Button>
          <Button loading={create.isPending && create.variables?.status === 'ORDERED'} onClick={() => submit('ORDERED')}>
            Place order ({money(total)})
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {fixedSupplier ? <Input label="Supplier" value={fixedSupplier.name} disabled /> : <Select label="Supplier" placeholder="Choose supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} options={(suppliers.data || []).map((s) => ({ value: s._id, label: s.name }))} />}
          <Input label="Expected delivery" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
        </div>
        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-3 sm:grid-cols-[1fr_110px_140px_110px_auto] sm:items-end">
              <Select
                label="Material"
                placeholder="Choose"
                value={line.material}
                onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, material: e.target.value, unitCost: byId.get(e.target.value)?.unitCost || 0 } : l)))}
                options={(materials.data || []).map((m) => ({ value: m._id, label: `${m.name} (${m.quantity} ${m.unit} in stock)` }))}
              />
              <Input label={`Qty${byId.get(line.material) ? ` (${byId.get(line.material).unit})` : ''}`} type="number" min="0" step="any" value={line.quantity} onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))} />
              <Input label="Unit cost" type="number" min="0" step="any" value={line.unitCost} onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, unitCost: e.target.value } : l)))} />
              <p className="pb-2 text-sm tabular-nums">{money(Number(line.quantity || 0) * Number(line.unitCost || 0))}</p>
              <button type="button" className="rounded p-2 text-stone-400 hover:text-red-600" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, i) => i !== idx) : ls))} aria-label="Remove line">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => setLines((ls) => [...ls, { material: '', quantity: 1, unitCost: 0 }])}>
            Add line
          </Button>
        </div>
        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}
