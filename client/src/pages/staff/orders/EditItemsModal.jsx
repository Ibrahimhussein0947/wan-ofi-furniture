import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import EntityPicker from '../../../components/ui/EntityPicker';
import { Input, Select, Textarea } from '../../../components/ui/Field';
import { ordersApi, productsApi } from '../../../api/endpoints';
import useMutationToast from '../../../hooks/useMutationToast';
import { money } from '../../../utils/format';

const key = () => Math.random().toString(36).slice(2);

/** Replaces the items of a pending order. Prices are recalculated by the server. */
export default function EditItemsModal({ open, onClose, order }) {
  const [lines, setLines] = useState([]);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setReason('');
    setLines(
      order.items
        .filter((i) => i.product)
        .map((i) => ({
          key: key(),
          product: { _id: i.product._id || i.product, name: i.name, sku: i.sku, sellingPrice: i.unitPrice, colors: i.color ? [i.color] : [] },
          quantity: i.quantity,
          color: i.color || '',
        }))
    );
  }, [open, order]);

  const update = (k, changes) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...changes } : l)));
  const subtotal = lines.reduce((s, l) => s + (l.product ? l.product.sellingPrice * l.quantity : 0), 0);

  const save = useMutationToast((body) => ordersApi.updateItems(order._id, body), { success: 'Order items updated', invalidate: ['order', 'orders'], onSuccess: onClose });
  const submit = () => {
    const items = lines.filter((l) => l.product).map((l) => ({ product: l.product._id, quantity: Number(l.quantity), color: l.color || undefined }));
    if (!items.length) return toast.error('Keep at least one product on the order.');
    if (reason.trim().length < 3) return toast.error('Please give a reason for the change.');
    return save.mutate({ items, reason: reason.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit items — ${order.orderNumber}`}
      description="Only possible while the order is pending. Any existing invoice is voided and prices are recalculated."
      size="xl"
      footer={
        <>
          <span className="mr-auto self-center text-sm text-stone-600">New subtotal: {money(subtotal)}</span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Save items
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {lines.map((line) => (
          <div key={line.key} className="grid gap-3 sm:grid-cols-[1fr_90px_140px_auto] sm:items-end">
            <EntityPicker
              label="Product"
              value={line.product}
              onChange={(product) => update(line.key, { product, color: product?.colors?.[0] || '' })}
              queryKey="products"
              fetcher={(search) => productsApi.list({ search, status: 'ACTIVE,OUT_OF_STOCK', limit: 15 }).then((r) => r.items)}
              getLabel={(p) => `${p.name}${p.sku ? ` (${p.sku})` : ''}`}
              getSubLabel={(p) => money(p.sellingPrice)}
            />
            <Input label="Qty" type="number" min="1" value={line.quantity} onChange={(e) => update(line.key, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
            <Select label="Colour" value={line.color} onChange={(e) => update(line.key, { color: e.target.value })} options={line.product?.colors || []} placeholder="—" disabled={!line.product?.colors?.length} />
            <button type="button" className="rounded p-2 text-stone-400 hover:text-red-600" onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))} aria-label="Remove line">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button size="sm" variant="secondary" icon={Plus} onClick={() => setLines((ls) => [...ls, { key: key(), product: null, quantity: 1, color: '' }])}>
          Add product
        </Button>
        <Textarea label="Reason for the change" required rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}
