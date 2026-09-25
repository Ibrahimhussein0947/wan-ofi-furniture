import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Field';
import EntityPicker from '../ui/EntityPicker';
import { ordersApi, paymentsApi, suppliersApi, purchasesApi, workersApi } from '../../api/endpoints';
import useMutationToast from '../../hooks/useMutationToast';
import { PAYMENT_METHODS } from '../../utils/constants';
import { label, money, toInputDate } from '../../utils/format';

const methodOptions = PAYMENT_METHODS.map((m) => ({ value: m, label: label(m) }));
const FINANCE_KEYS = ['order', 'orders', 'payments', 'dashboard', 'invoices', 'customer', 'transactions'];

function footer(onClose, onSubmit, loading, text = 'Save') {
  return (
    <>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button onClick={onSubmit} loading={loading}>
        {text}
      </Button>
    </>
  );
}

/** Records a customer payment. Pass `order` to lock it, or let the user pick one with a balance. */
export function CustomerPaymentModal({ open, onClose, order: fixedOrder }) {
  const [order, setOrder] = useState(fixedOrder || null);
  useEffect(() => setOrder(fixedOrder || null), [fixedOrder, open]);
  const form = useForm({ values: { amount: fixedOrder?.balance || '', method: 'CASH', reference: '', notes: '', paidAt: toInputDate(new Date()) } });
  const mutation = useMutationToast((body) => paymentsApi.customer(body), {
    success: (r) => `Payment recorded. Remaining balance: ${money(r.order.balance)}`,
    invalidate: FINANCE_KEYS,
    onSuccess: () => {
      form.reset();
      onClose();
    },
  });
  const balance = order?.balance ?? 0;
  const submit = form.handleSubmit((v) => mutation.mutate({ ...v, order: order._id, amount: Number(v.amount) }));

  return (
    <Modal open={open} onClose={onClose} title="Record customer payment" footer={footer(onClose, submit, mutation.isPending, 'Record payment')}>
      <div className="space-y-4">
        {fixedOrder ? (
          <p className="rounded-lg bg-stone-50 p-3 text-sm">
            Order <strong>{fixedOrder.orderNumber}</strong> · Total {money(fixedOrder.total)} · Paid {money(fixedOrder.amountPaid)} ·{' '}
            <strong>Balance {money(fixedOrder.balance)}</strong>
          </p>
        ) : (
          <EntityPicker
            label="Order"
            required
            value={order}
            onChange={(o) => {
              setOrder(o);
              if (o) form.setValue('amount', o.balance);
            }}
            queryKey="orders"
            fetcher={(search) => ordersApi.list({ search, withBalance: 'true', status: 'PENDING,CONFIRMED,PAID,IN_PRODUCTION,READY,OUT_FOR_DELIVERY,DELIVERED', limit: 15 }).then((r) => r.items)}
            getLabel={(o) => `${o.orderNumber} — ${o.customer?.name || ''}`}
            getSubLabel={(o) => `Balance ${money(o.balance)} of ${money(o.total)}`}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Amount"
            type="number"
            step="any"
            required
            error={form.formState.errors.amount?.message}
            hint={order ? `Maximum ${money(balance)}` : undefined}
            {...form.register('amount', {
              required: 'Enter an amount',
              validate: (v) => (Number(v) > 0 && Number(v) <= balance + 0.001) || `Payment exceeds remaining balance (${money(balance)})`,
            })}
          />
          <Select label="Method" options={methodOptions} {...form.register('method')} />
          <Input label="Reference" placeholder="Receipt / transfer ref." {...form.register('reference')} />
          <Input label="Date" type="date" {...form.register('paidAt')} />
        </div>
        <Textarea label="Notes" rows={2} {...form.register('notes')} />
      </div>
    </Modal>
  );
}

export function RefundModal({ open, onClose, order }) {
  const form = useForm({ values: { amount: order?.amountPaid || '', method: 'CASH', reference: '', reason: '' } });
  const mutation = useMutationToast((body) => paymentsApi.refund(body), { success: 'Refund recorded', invalidate: FINANCE_KEYS, onSuccess: onClose });
  const submit = form.handleSubmit((v) => mutation.mutate({ ...v, order: order._id, amount: Number(v.amount) }));
  return (
    <Modal open={open} onClose={onClose} title="Issue refund" description={`Paid so far: ${money(order?.amountPaid)}`} footer={footer(onClose, submit, mutation.isPending, 'Record refund')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Amount" type="number" step="any" error={form.formState.errors.amount?.message} {...form.register('amount', { validate: (v) => (Number(v) > 0 && Number(v) <= (order?.amountPaid || 0)) || 'Refund exceeds the amount paid' })} />
        <Select label="Method" options={methodOptions} {...form.register('method')} />
        <Input label="Reference" containerClassName="sm:col-span-2" {...form.register('reference')} />
        <Textarea label="Reason" required containerClassName="sm:col-span-2" error={form.formState.errors.reason && 'Please give a reason'} {...form.register('reason', { required: true, minLength: 3 })} />
      </div>
    </Modal>
  );
}

export function DiscountModal({ open, onClose, order }) {
  const form = useForm({ values: { discount: order?.discount || 0, reason: '' } });
  const discount = Number(form.watch('discount') || 0);
  const newTotal = (order?.subtotal || 0) - discount + (order?.deliveryFee || 0);
  const mutation = useMutationToast(({ id, ...body }) => ordersApi.action(id, 'discount', body), { success: 'Discount applied', invalidate: FINANCE_KEYS, onSuccess: onClose });
  const submit = form.handleSubmit((v) => mutation.mutate({ id: order._id, discount: Number(v.discount), reason: v.reason }));
  return (
    <Modal open={open} onClose={onClose} title="Apply discount" footer={footer(onClose, submit, mutation.isPending, 'Apply discount')}>
      <div className="space-y-4">
        <Input
          label="Discount amount"
          type="number"
          step="any"
          min="0"
          error={form.formState.errors.discount?.message}
          {...form.register('discount', {
            validate: (v) => {
              const d = Number(v);
              if (d < 0 || d > order.subtotal) return 'Discount cannot exceed the subtotal';
              if (order.subtotal - d + order.deliveryFee < order.amountPaid) return 'Total would be lower than the amount already paid';
              return true;
            },
          })}
        />
        <p className="rounded-lg bg-stone-50 p-3 text-sm">
          New total: <strong>{money(newTotal)}</strong> · New balance: <strong>{money(Math.max(newTotal - (order?.amountPaid || 0), 0))}</strong>
        </p>
        <Textarea label="Reason" required error={form.formState.errors.reason && 'Please give a reason'} {...form.register('reason', { required: true, minLength: 3 })} />
      </div>
    </Modal>
  );
}

export function SupplierPaymentModal({ open, onClose, supplier: fixedSupplier }) {
  const [supplier, setSupplier] = useState(fixedSupplier || null);
  const [po, setPo] = useState(null);
  useEffect(() => {
    setSupplier(fixedSupplier || null);
    setPo(null);
  }, [fixedSupplier, open]);
  const form = useForm({ values: { amount: '', method: 'BANK_TRANSFER', reference: '', notes: '' } });
  const mutation = useMutationToast((body) => paymentsApi.supplier(body), { success: 'Supplier payment recorded', invalidate: ['supplier', 'suppliers', 'purchases', 'purchase', ...FINANCE_KEYS], onSuccess: onClose });
  const submit = form.handleSubmit((v) => mutation.mutate({ ...v, amount: Number(v.amount), supplier: supplier._id, purchaseOrder: po?._id }));
  return (
    <Modal open={open} onClose={onClose} title="Pay supplier" footer={footer(onClose, submit, mutation.isPending, 'Record payment')}>
      <div className="space-y-4">
        {!fixedSupplier && (
          <EntityPicker label="Supplier" required value={supplier} onChange={setSupplier} queryKey="suppliers" fetcher={(search) => suppliersApi.list({ search, limit: 15 }).then((r) => r.items)} getLabel={(s) => s.name} getSubLabel={(s) => `Owed ${money(s.balance)}`} />
        )}
        {supplier && (
          <>
            <p className="rounded-lg bg-stone-50 p-3 text-sm">
              Amount owed to {supplier.name}: <strong>{money(supplier.balance)}</strong>
            </p>
            <EntityPicker
              label="Against purchase order (optional)"
              value={po}
              onChange={setPo}
              queryKey={`po-${supplier._id}`}
              fetcher={(search) => purchasesApi.list({ supplier: supplier._id, search, limit: 15 }).then((r) => r.items.filter((p) => p.status !== 'CANCELLED' && p.amountPaid < p.total))}
              getLabel={(p) => p.poNumber}
              getSubLabel={(p) => `Total ${money(p.total)} · paid ${money(p.amountPaid)}`}
            />
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Amount" type="number" step="any" required error={form.formState.errors.amount && 'Enter an amount'} {...form.register('amount', { required: true, min: 0.01 })} />
          <Select label="Method" options={methodOptions} {...form.register('method')} />
          <Input label="Reference" containerClassName="sm:col-span-2" {...form.register('reference')} />
        </div>
        <Textarea label="Notes" rows={2} {...form.register('notes')} />
      </div>
    </Modal>
  );
}

export function WorkerPaymentModal({ open, onClose, worker: fixedWorker }) {
  const [worker, setWorker] = useState(fixedWorker || null);
  useEffect(() => setWorker(fixedWorker || null), [fixedWorker, open]);
  const form = useForm({ values: { amount: fixedWorker?.wageRate || '', method: 'BANK_TRANSFER', kind: 'WAGE', period: new Date().toLocaleString('en', { month: 'long', year: 'numeric' }), reference: '' } });
  const mutation = useMutationToast((body) => paymentsApi.worker(body), { success: 'Worker payment recorded', invalidate: ['worker', 'workers', ...FINANCE_KEYS], onSuccess: onClose });
  const submit = form.handleSubmit((v) => mutation.mutate({ ...v, amount: Number(v.amount), worker: worker._id }));
  return (
    <Modal open={open} onClose={onClose} title="Pay worker" footer={footer(onClose, submit, mutation.isPending, 'Record payment')}>
      <div className="space-y-4">
        {!fixedWorker && (
          <EntityPicker
            label="Worker"
            required
            value={worker}
            onChange={(w) => {
              setWorker(w);
              if (w?.wageRate) form.setValue('amount', w.wageRate);
            }}
            queryKey="workers"
            fetcher={(search) => workersApi.list({ search, limit: 20 }).then((r) => r.items)}
            getLabel={(w) => w.user?.name || w.employeeCode}
            getSubLabel={(w) => `${label(w.position)} · ${label(w.wageType)} ${money(w.wageRate)}`}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Amount" type="number" step="any" required {...form.register('amount', { required: true, min: 0.01 })} />
          <Select label="Type" options={['WAGE', 'BONUS', 'ADVANCE'].map((v) => ({ value: v, label: label(v) }))} {...form.register('kind')} />
          <Select label="Method" options={methodOptions} {...form.register('method')} />
          <Input label="Period" {...form.register('period')} />
          <Input label="Reference" containerClassName="sm:col-span-2" {...form.register('reference')} />
        </div>
      </div>
    </Modal>
  );
}
