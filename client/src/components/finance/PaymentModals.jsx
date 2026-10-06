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
import { useT } from '../../i18n/LanguageContext';

const methodOptions = PAYMENT_METHODS.map((m) => ({ value: m, label: label(m) }));
const FINANCE_KEYS = ['order', 'orders', 'payments', 'dashboard', 'invoices', 'customer', 'transactions'];

function ModalFooter({ onClose, onSubmit, loading, text = 'Save' }) {
  const t = useT();
  return (
    <>
      <Button variant="secondary" onClick={onClose}>
        {t('Cancel')}
      </Button>
      <Button onClick={onSubmit} loading={loading}>
        {t(text)}
      </Button>
    </>
  );
}

const footer = (onClose, onSubmit, loading, text) => <ModalFooter onClose={onClose} onSubmit={onSubmit} loading={loading} text={text} />;

/** Records a customer payment. Pass `order` to lock it, or let the user pick one with a balance. */
export function CustomerPaymentModal({ open, onClose, order: fixedOrder }) {
  const t = useT();
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
    <Modal open={open} onClose={onClose} title={t('Record customer payment')} footer={footer(onClose, submit, mutation.isPending, 'Record payment')}>
      <div className="space-y-4">
        {fixedOrder ? (
          <p className="rounded-lg bg-stone-50 p-3 text-sm">
            {t('Order')} <strong>{fixedOrder.orderNumber}</strong> · Total {money(fixedOrder.total)} · Paid {money(fixedOrder.amountPaid)} ·{' '}
            <strong>Balance {money(fixedOrder.balance)}</strong>
          </p>
        ) : (
          <EntityPicker
            label={t('Order')}
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
            label={t('Amount')}
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
          <Select label={t('Method')} options={methodOptions} {...form.register('method')} />
          <Input label={t('Reference')} placeholder={t('Receipt / transfer ref.')} {...form.register('reference')} />
          <Input label={t('Date')} type="date" {...form.register('paidAt')} />
        </div>
        <Textarea label={t('Notes')} rows={2} {...form.register('notes')} />
      </div>
    </Modal>
  );
}

export function RefundModal({ open, onClose, order }) {
  const t = useT();
  const form = useForm({ values: { amount: order?.amountPaid || '', method: 'CASH', reference: '', reason: '' } });
  const mutation = useMutationToast((body) => paymentsApi.refund(body), { success: 'Refund recorded', invalidate: FINANCE_KEYS, onSuccess: onClose });
  const submit = form.handleSubmit((v) => mutation.mutate({ ...v, order: order._id, amount: Number(v.amount) }));
  return (
    <Modal open={open} onClose={onClose} title={t('Issue refund')} description={`Paid so far: ${money(order?.amountPaid)}`} footer={footer(onClose, submit, mutation.isPending, 'Record refund')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('Amount')} type="number" step="any" error={form.formState.errors.amount?.message} {...form.register('amount', { validate: (v) => (Number(v) > 0 && Number(v) <= (order?.amountPaid || 0)) || 'Refund exceeds the amount paid' })} />
        <Select label={t('Method')} options={methodOptions} {...form.register('method')} />
        <Input label={t('Reference')} containerClassName="sm:col-span-2" {...form.register('reference')} />
        <Textarea label={t('Reason')} required containerClassName="sm:col-span-2" error={form.formState.errors.reason && 'Please give a reason'} {...form.register('reason', { required: true, minLength: 3 })} />
      </div>
    </Modal>
  );
}

export function DiscountModal({ open, onClose, order }) {
  const t = useT();
  const form = useForm({ values: { discount: order?.discount || 0, reason: '' } });
  const discount = Number(form.watch('discount') || 0);
  const newTotal = (order?.subtotal || 0) - discount + (order?.deliveryFee || 0);
  const mutation = useMutationToast(({ id, ...body }) => ordersApi.action(id, 'discount', body), { success: 'Discount applied', invalidate: FINANCE_KEYS, onSuccess: onClose });
  const submit = form.handleSubmit((v) => mutation.mutate({ id: order._id, discount: Number(v.discount), reason: v.reason }));
  return (
    <Modal open={open} onClose={onClose} title={t('Apply discount')} footer={footer(onClose, submit, mutation.isPending, 'Apply discount')}>
      <div className="space-y-4">
        <Input
          label={t('Discount amount')}
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
          {t('New total:')} <strong>{money(newTotal)}</strong> · New balance: <strong>{money(Math.max(newTotal - (order?.amountPaid || 0), 0))}</strong>
        </p>
        <Textarea label={t('Reason')} required error={form.formState.errors.reason && 'Please give a reason'} {...form.register('reason', { required: true, minLength: 3 })} />
      </div>
    </Modal>
  );
}

export function SupplierPaymentModal({ open, onClose, supplier: fixedSupplier }) {
  const t = useT();
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
    <Modal open={open} onClose={onClose} title={t('Pay supplier')} footer={footer(onClose, submit, mutation.isPending, 'Record payment')}>
      <div className="space-y-4">
        {!fixedSupplier && (
          <EntityPicker label={t('Supplier')} required value={supplier} onChange={setSupplier} queryKey="suppliers" fetcher={(search) => suppliersApi.list({ search, limit: 15 }).then((r) => r.items)} getLabel={(s) => s.name} getSubLabel={(s) => `Owed ${money(s.balance)}`} />
        )}
        {supplier && (
          <>
            <p className="rounded-lg bg-stone-50 p-3 text-sm">
              Amount owed to {supplier.name}: <strong>{money(supplier.balance)}</strong>
            </p>
            <EntityPicker
              label={t('Against purchase order (optional)')}
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
          <Input label={t('Amount')} type="number" step="any" required error={form.formState.errors.amount && 'Enter an amount'} {...form.register('amount', { required: true, min: 0.01 })} />
          <Select label={t('Method')} options={methodOptions} {...form.register('method')} />
          <Input label={t('Reference')} containerClassName="sm:col-span-2" {...form.register('reference')} />
        </div>
        <Textarea label={t('Notes')} rows={2} {...form.register('notes')} />
      </div>
    </Modal>
  );
}

const monthLabel = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// What the worker actually takes home: the wage rate less their admin-set tax rate.
const netWage = (w) => (w?.wageRate ? Math.round(w.wageRate * (1 - (w.taxRate || 0) / 100)) : '');

export function WorkerPaymentModal({ open, onClose, worker: fixedWorker }) {
  const t = useT();
  const [worker, setWorker] = useState(fixedWorker || null);
  useEffect(() => setWorker(fixedWorker || null), [fixedWorker, open]);
  const today = toInputDate(new Date());
  const form = useForm({ values: { amount: netWage(fixedWorker) || '', method: 'CASH', kind: 'WAGE', payPeriod: today.slice(0, 7), paidAt: today, reference: '', notes: '' } });
  const mutation = useMutationToast((body) => paymentsApi.worker(body), { success: 'Worker payment recorded', invalidate: ['worker', 'workers', ...FINANCE_KEYS], onSuccess: onClose });
  // The pay month links the money to that month's payroll, so it counts against what the worker is owed.
  const submit = form.handleSubmit(({ payPeriod, paidAt, reference, notes, ...v }) =>
    mutation.mutate({
      ...v,
      amount: Number(v.amount),
      worker: worker._id,
      payPeriod: payPeriod || undefined,
      period: payPeriod ? monthLabel(payPeriod) : undefined,
      // Today's payments keep the current time; earlier ones are back-dated to that day.
      paidAt: paidAt && paidAt !== today ? paidAt : undefined,
      reference: reference || undefined,
      notes: notes || undefined,
    })
  );
  return (
    <Modal open={open} onClose={onClose} title={t('Pay worker')} footer={footer(onClose, submit, mutation.isPending, 'Record payment')}>
      <div className="space-y-4">
        {!fixedWorker && (
          <EntityPicker
            label={t('Worker')}
            required
            value={worker}
            onChange={(w) => {
              setWorker(w);
              const net = netWage(w);
              if (net) form.setValue('amount', net);
            }}
            queryKey="workers"
            fetcher={(search) => workersApi.list({ search, limit: 20 }).then((r) => r.items)}
            getLabel={(w) => w.user?.name || w.employeeCode}
            getSubLabel={(w) => `${t(label(w.position))} · ${t(label(w.wageType))} ${money(w.wageRate)}`}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('Amount')} type="number" step="any" required {...form.register('amount', { required: true, min: 0.01 })} />
          <Select label={t('Type')} options={['WAGE', 'BONUS', 'ADVANCE'].map((v) => ({ value: v, label: t(label(v)) }))} {...form.register('kind')} />
          <Select label={t('Method')} options={methodOptions} {...form.register('method')} />
          <Input label={t('Date given')} type="date" max={today} required {...form.register('paidAt', { required: true })} />
          <Input label={t('Pay month')} type="month" hint={t('Payroll month this money counts toward')} {...form.register('payPeriod')} />
          <Input label={t('Reference')} containerClassName="sm:col-span-2" {...form.register('reference')} />
        </div>
        <Textarea label={t('Notes')} rows={2} placeholder={t('e.g. advance for transport, bonus for early delivery')} {...form.register('notes')} />
      </div>
    </Modal>
  );
}
