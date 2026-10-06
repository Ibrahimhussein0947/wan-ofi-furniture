import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { Card, PageHeader } from '../../../components/ui/misc';
import { Checkbox, Input, Select, Textarea } from '../../../components/ui/Field';
import EntityPicker from '../../../components/ui/EntityPicker';
import CustomerFormModal from '../customers/CustomerFormModal';
import { customersApi, ordersApi, productsApi } from '../../../api/endpoints';
import { errorMessage } from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import { money } from '../../../utils/format';
import BranchSelect from '../../../components/BranchSelect';
import { usePublicSettings } from '../../../components/SettingsLoader';
import { useT } from '../../../i18n/LanguageContext';

const emptyLine = () => ({ key: Math.random().toString(36).slice(2), product: null, quantity: 1, color: '' });

export default function NewOrder() {
  const t = useT();
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const { data: settings } = usePublicSettings();
  const [customer, setCustomer] = useState(null);
  const [lines, setLines] = useState([emptyLine()]);
  const [deliveryMethod, setDeliveryMethod] = useState('PICKUP');
  const [discount, setDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [branch, setBranch] = useState(user?.branch || '');
  const [saving, setSaving] = useState(false);
  const [newCustomer, setNewCustomer] = useState(false);

  const subtotal = lines.reduce((s, l) => s + (l.product ? l.product.sellingPrice * l.quantity : 0), 0);
  const taxRate = settings?.taxRate || 0;
  const taxable = Math.max(subtotal - Number(discount || 0), 0);
  const tax = Math.round(taxable * taxRate) / 100;
  const total = taxable + tax + (deliveryMethod === 'DELIVERY' ? Number(deliveryFee || 0) : 0);
  const updateLine = (key, changes) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...changes } : l)));

  const submit = async () => {
    const items = lines.filter((l) => l.product);
    if (!customer) return toast.error('Choose a customer.');
    if (!items.length) return toast.error('Add at least one product.');
    if (Number(discount) > subtotal) return toast.error('Discount cannot exceed the subtotal.');
    setSaving(true);
    try {
      const order = await ordersApi.create({
        customer: customer._id,
        items: items.map((l) => ({ product: l.product._id, quantity: Number(l.quantity), color: l.color || undefined })),
        deliveryMethod,
        deliveryAddress: deliveryMethod === 'DELIVERY' ? customer.address : undefined,
        contactPhone: customer.phone,
        discount: Number(discount) || 0,
        deliveryFee: deliveryMethod === 'DELIVERY' ? Number(deliveryFee) || 0 : 0,
        notes: notes || undefined,
        internalNotes: internalNotes || undefined,
        autoConfirm,
        branch: branch || undefined,
      });
      toast.success(`Order ${order.orderNumber} created`);
      navigate(`/app/orders/${order._id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader back="/app/orders" title={t('New order')} subtitle={t('For walk-in, phone or showroom customers')} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title={t('Customer')} actions={can('customers:write') && <Button size="sm" variant="secondary" icon={UserPlus} onClick={() => setNewCustomer(true)}>{t('New customer')}</Button>}>
            <EntityPicker
              label={t('Customer')}
              required
              value={customer}
              onChange={setCustomer}
              queryKey="customers"
              fetcher={(search) => customersApi.list({ search, limit: 15 }).then((r) => r.items)}
              getLabel={(c) => c.name}
              getSubLabel={(c) => [c.phone, c.customerCode, c.balance > 0 && `owes ${money(c.balance)}`].filter(Boolean).join(' · ')}
            />
          </Card>

          <Card title={t('Products')} padded={false}>
            <ul className="divide-y divide-stone-100">
              {lines.map((line) => (
                <li key={line.key} className="grid gap-3 p-4 sm:grid-cols-[1fr_90px_140px_auto] sm:items-end">
                  <EntityPicker
                    label={t('Product')}
                    value={line.product}
                    onChange={(product) => updateLine(line.key, { product, color: product?.colors?.[0] || '' })}
                    queryKey="products"
                    fetcher={(search) => productsApi.list({ search, status: 'ACTIVE,OUT_OF_STOCK', limit: 15 }).then((r) => r.items)}
                    getLabel={(p) => `${p.name} (${p.sku})`}
                    getSubLabel={(p) => `${money(p.sellingPrice)} · ${p.quantity} in stock${p.madeToOrder ? ' · made to order' : ''}`}
                  />
                  <Input label={t('Qty')} type="number" min="1" value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                  <Select label={t('Colour')} value={line.color} onChange={(e) => updateLine(line.key, { color: e.target.value })} options={line.product?.colors || []} placeholder="—" disabled={!line.product?.colors?.length} />
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-sm font-medium tabular-nums">{line.product ? money(line.product.sellingPrice * line.quantity) : '—'}</span>
                    <button type="button" className="rounded p-2 text-stone-400 hover:text-red-600" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== line.key) : ls))} aria-label="Remove line">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-stone-100 p-4">
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => setLines((ls) => [...ls, emptyLine()])}>
                {t('Add product')}
              </Button>
            </div>
          </Card>

          <Card title={t('Notes')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Textarea label={t('Customer-visible notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Textarea label={t('Internal notes')} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
            </div>
          </Card>
        </div>

        <Card title={t('Summary')} className="h-fit">
          <div className="space-y-4">
            <Select
              label={t('Delivery method')}
              value={deliveryMethod}
              onChange={(e) => setDeliveryMethod(e.target.value)}
              options={[
                { value: 'PICKUP', label: 'Customer collects' },
                { value: 'DELIVERY', label: 'Deliver to customer' },
              ]}
            />
            {deliveryMethod === 'DELIVERY' && <Input label={t('Delivery fee')} type="number" min="0" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />}
            {can('discounts:write') && <Input label={t('Discount')} type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />}
            <BranchSelect label={t('Branch')} placeholder={t('Default branch')} value={branch} onChange={(e) => setBranch(e.target.value)} />
            <dl className="space-y-1.5 border-t border-stone-100 pt-3 text-sm">
              <div className="flex justify-between">
                <dt>{t('Subtotal')}</dt>
                <dd className="tabular-nums">{money(subtotal)}</dd>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between">
                  <dt>VAT ({taxRate}%)</dt>
                  <dd className="tabular-nums">{money(tax)}</dd>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold">
                <dt>{t('Total')}</dt>
                <dd className="tabular-nums">{money(total)}</dd>
              </div>
            </dl>
            {can('orders:approve') && <Checkbox label={t('Confirm immediately (skip deposit)')} checked={autoConfirm} onChange={(e) => setAutoConfirm(e.target.checked)} />}
            <Button block size="lg" loading={saving} onClick={submit}>
              {t('Create order')}
            </Button>
          </div>
        </Card>
      </div>
      <CustomerFormModal
        open={newCustomer}
        onClose={() => setNewCustomer(false)}
        onSaved={(c) => {
          setCustomer(c);
          setNewCustomer(false);
        }}
      />
    </div>
  );
}
