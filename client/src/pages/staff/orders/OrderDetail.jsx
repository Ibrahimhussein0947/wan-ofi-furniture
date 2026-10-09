import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BellRing, Banknote, CheckCircle2, FileText, Percent, RotateCcw, Truck, XCircle, PackageCheck, Receipt, PencilLine } from 'lucide-react';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { Card, DetailList, PageHeader, ProgressBar } from '../../../components/ui/misc';
import { StatusBadge, Badge } from '../../../components/ui/Badge';
import { QueryState } from '../../../components/ui/States';
import OrderTimeline from '../../../components/OrderTimeline';
import { CustomerPaymentModal, DiscountModal, RefundModal } from '../../../components/finance/PaymentModals';
import ScheduleDeliveryModal from '../deliveries/ScheduleDeliveryModal';
import EditItemsModal from './EditItemsModal';
import { invoicesApi, ordersApi } from '../../../api/endpoints';
import { fileUrl } from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import useMutationToast from '../../../hooks/useMutationToast';
import { date, dateTime, label, money } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

const KEYS = ['order', 'orders', 'dashboard'];

export default function OrderDetail() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [modal, setModal] = useState(null);
  const query = useQuery({ queryKey: ['order', id], queryFn: () => ordersApi.get(id) });

  const remind = useMutationToast(() => ordersApi.action(id, 'remind', {}), { success: 'Reminder sent to the customer', invalidate: ['order'] });
  const confirm = useMutationToast(() => ordersApi.action(id, 'confirm', {}), { success: 'Order confirmed', invalidate: KEYS });
  const status = useMutationToast((body) => ordersApi.action(id, 'status', body), { success: (o) => `Order ${t(label(o.status)).toLowerCase()}`, invalidate: KEYS, onSuccess: () => setModal(null) });
  const cancel = useMutationToast((reason) => ordersApi.action(id, 'cancel', { reason }), { success: 'Order cancelled', invalidate: KEYS, onSuccess: () => setModal(null) });
  const invoice = useMutationToast(() => invoicesApi.create({ order: id }), { success: 'Invoice ready', invalidate: KEYS, onSuccess: (inv) => navigate(`/app/invoices/${inv._id}`) });

  return (
    <QueryState query={query}>
      {(o) => {
        const open = !['CANCELLED', 'COMPLETED'].includes(o.status);
        const activeDelivery = o.deliveries?.find((d) => !['DELIVERED', 'FAILED'].includes(d.status));
        return (
          <div className="space-y-6">
            <PageHeader
              back="/app/orders"
              title={`Order ${o.orderNumber}`}
              subtitle={
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={o.status} />
                  <StatusBadge status={o.paymentStatus} />
                  {o.orderType === 'CUSTOM' && <Badge tone="violet">Custom</Badge>}
                  <span>
                    Placed {dateTime(o.orderDate)} · {t(label(o.source))}
                  </span>
                </span>
              }
              actions={
                <>
                  {o.status === 'PENDING' && can('orders:approve') && (
                    <Button icon={CheckCircle2} loading={confirm.isPending} onClick={() => confirm.mutate()}>
                      {t('Confirm order')}
                    </Button>
                  )}
                  {open && o.balance > 0 && can('payments:write') && (
                    <Button icon={Banknote} variant={o.status === 'PENDING' ? 'secondary' : 'primary'} onClick={() => setModal('pay')}>
                      {t('Record payment')}
                    </Button>
                  )}
                  {o.status === 'READY' && o.deliveryMethod === 'DELIVERY' && !activeDelivery && can('deliveries:manage') && (
                    <Button icon={Truck} onClick={() => setModal('delivery')}>
                      {t('Schedule delivery')}
                    </Button>
                  )}
                  {o.status === 'READY' && o.deliveryMethod === 'PICKUP' && can('orders:write') && (
                    <Button icon={PackageCheck} onClick={() => setModal('collected')}>
                      {t('Mark collected')}
                    </Button>
                  )}
                  {o.status === 'DELIVERED' && o.balance <= 0 && can('orders:write') && (
                    <Button icon={CheckCircle2} onClick={() => status.mutate({ status: 'COMPLETED' })}>
                      {t('Complete')}
                    </Button>
                  )}
                  {o.status === 'PENDING' && o.orderType !== 'CUSTOM' && can('orders:write') && (
                    <Button variant="secondary" icon={PencilLine} onClick={() => setModal('items')}>
                      {t('Edit items')}
                    </Button>
                  )}
                  {o.status !== 'CANCELLED' && can('invoices:write') && (
                    <Button variant="secondary" icon={FileText} loading={invoice.isPending} onClick={() => (o.invoices?.find((i) => i.status !== 'VOID') ? navigate(`/app/invoices/${o.invoices.find((i) => i.status !== 'VOID')._id}`) : invoice.mutate())}>
                      {t('Invoice')}
                    </Button>
                  )}
                </>
              }
            />

            <Card>
              <OrderTimeline order={o} />
            </Card>

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="space-y-6 xl:col-span-2">
                <Card title={t('Items')} padded={false}>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-stone-100">
                      <thead className="bg-stone-50">
                        <tr>
                          <th className="table-th">{t('Item')}</th>
                          <th className="table-th">{t('Fulfilment')}</th>
                          <th className="table-th text-right">{t('Qty')}</th>
                          <th className="table-th text-right">{t('Unit price')}</th>
                          <th className="table-th text-right">{t('Unit cost')}</th>
                          <th className="table-th text-right">{t('Total')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {o.items.map((i) => (
                          <tr key={i._id}>
                            <td className="table-td">
                              <p className="font-medium">{i.name}</p>
                              <p className="text-xs text-stone-500">{[i.sku, i.color, i.size, i.options].filter(Boolean).join(' · ')}</p>
                            </td>
                            <td className="table-td">
                              <Badge tone={i.fulfillment === 'STOCK' ? 'teal' : 'violet'}>{i.fulfillment === 'STOCK' ? (i.stockDeducted ? 'From stock ✓' : 'From stock') : 'Production'}</Badge>
                            </td>
                            <td className="table-td text-right">{i.quantity}</td>
                            <td className="table-td text-right tabular-nums">{money(i.unitPrice)}</td>
                            <td className="table-td text-right tabular-nums text-stone-500">{money(i.unitCost)}</td>
                            <td className="table-td text-right tabular-nums">{money(i.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {o.production?.length > 0 && (
                  <Card title={t('Production jobs')} padded={false}>
                    <ul className="divide-y divide-stone-100">
                      {o.production.map((j) => (
                        <li key={j._id}>
                          <Link to={`/app/production/${j._id}`} className="block px-5 py-3 hover:bg-stone-50">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">
                                {j.jobNumber} · {j.title}
                              </span>
                              <StatusBadge status={j.stage} />
                            </div>
                            <ProgressBar value={j.progress} showLabel className="mt-2" />
                            <p className="mt-1 text-xs text-stone-500">
                              {j.assignedWorkers?.length ? j.assignedWorkers.map((w) => w.name).join(', ') : 'Not yet assigned'} · due {date(j.expectedCompletionDate)}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                <Card title={t('Payments')} padded={false}>
                  {!o.payments.length ? (
                    <p className="p-5 text-sm text-stone-500">No payments yet. Deposit required: {money(o.depositRequired)}</p>
                  ) : (
                    <ul className="divide-y divide-stone-100">
                      {o.payments.map((p) => (
                        <li key={p._id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                          <span>
                            <span className="font-medium">{p.receiptNumber || p.paymentNumber}</span>
                            <span className="block text-xs text-stone-500">
                              {dateTime(p.paidAt)} · {t(label(p.method))} · {t(label(p.kind))} {p.receivedBy && `· by ${p.receivedBy.name}`}
                            </span>
                            {p.percent && (
                              <span className="block text-xs text-stone-600">
                                {p.percent === 100 ? t('Customer chose: paying in full') : t('Customer chose: {pct}% of the order', { pct: p.percent })}
                              </span>
                            )}
                            {p.reference && (
                              <span className="block text-xs text-stone-600">
                                {t('Reference')}: <span className="font-mono">{p.reference}</span>
                              </span>
                            )}
                            {p.status === 'PENDING_VERIFICATION' && !p.screenshot && (
                              <span className="block text-xs text-amber-700">{t('No receipt uploaded yet')}</span>
                            )}
                          </span>
                          {p.screenshot && (
                            <a href={fileUrl(p.screenshot)} target="_blank" rel="noreferrer" title={t('View the receipt the customer uploaded')}>
                              <img src={fileUrl(p.screenshot)} alt={t('Transfer receipt')} className="h-14 w-14 rounded border border-stone-200 object-cover" />
                            </a>
                          )}
                          <span className="flex items-center gap-3">
                            {p.status !== 'COMPLETED' && <StatusBadge status={p.status} />}
                            {p.status === 'PENDING_VERIFICATION' && can('payments:write') && (
                              <Link to="/app/payments?status=PENDING_VERIFICATION" className="text-xs font-medium text-walnut-700 hover:underline">
                                {t('Review')}
                              </Link>
                            )}
                            <span className={`font-semibold tabular-nums ${p.category === 'REFUND' ? 'text-red-600' : ''}`}>
                              {p.category === 'REFUND' ? '−' : ''}
                              {money(p.amount)}
                            </span>
                            {p.status === 'COMPLETED' && (
                              <Link to={`/app/receipts/${p._id}`} className="text-walnut-700 hover:underline" aria-label={t('Receipt')}>
                                <Receipt className="h-4 w-4" />
                              </Link>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card title={t('History')}>
                  <ol className="space-y-3 border-l-2 border-walnut-100 pl-4">
                    {[...o.statusHistory].reverse().map((h, i) => (
                      <li key={i} className="relative text-sm">
                        <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-walnut-600" />
                        <span className="font-medium">{t(label(h.status))}</span>
                        {h.note && <span className="text-stone-600"> — {h.note}</span>}
                        <p className="text-xs text-stone-500">
                          {dateTime(h.changedAt)} {h.changedBy?.name && `· ${h.changedBy.name}`}
                        </p>
                      </li>
                    ))}
                  </ol>
                </Card>
              </div>

              <div className="space-y-6">
                <Card title={t('Totals')}>
                  <dl className="space-y-2 text-sm">
                    {[
                      ['Subtotal', o.subtotal],
                      ['Discount', -o.discount],
                      ...(o.tax ? [[`VAT (${o.taxRate}%)`, o.tax]] : []),
                      ['Delivery fee', o.deliveryFee],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt className="text-stone-600">{k}</dt>
                        <dd className="tabular-nums">{money(v)}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-stone-100 pt-2 font-semibold">
                      <dt>{t('Total')}</dt>
                      <dd className="tabular-nums">{money(o.total)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-stone-600">{t('Paid')}</dt>
                      <dd className="tabular-nums text-emerald-700">{money(o.amountPaid)}</dd>
                    </div>
                    <div className="flex justify-between rounded-lg bg-walnut-50 px-3 py-2 text-base font-semibold text-walnut-900">
                      <dt>{t('Balance')}</dt>
                      <dd className="tabular-nums">{money(o.balance)}</dd>
                    </div>
                    <p className="text-xs text-stone-500">Deposit required: {money(o.depositRequired)}</p>
                    {o.balance > 0 && o.status !== 'CANCELLED' && (
                      <p className="text-xs text-stone-500">
                        {o.lastPaymentReminderAt ? t('Last reminded {when}', { when: dateTime(o.lastPaymentReminderAt) }) : t('Not reminded yet')} ·{' '}
                        {t('Reminders go out weekly until it is paid')}
                      </p>
                    )}
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {o.balance > 0 && o.status !== 'CANCELLED' && can('payments:write') && (
                      <Button size="sm" variant="secondary" icon={BellRing} loading={remind.isPending} onClick={() => remind.mutate()}>
                        {t('Send reminder')}
                      </Button>
                    )}
                    {open && can('discounts:write') && (
                      <Button size="sm" variant="secondary" icon={Percent} onClick={() => setModal('discount')}>
                        {t('Discount')}
                      </Button>
                    )}
                    {o.amountPaid > 0 && can('refunds:write') && (
                      <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => setModal('refund')}>
                        {t('Refund')}
                      </Button>
                    )}
                  </div>
                </Card>

                <Card title={t('Customer')} subtitle={o.branch ? `Branch: ${o.branch.name}` : undefined}>
                  <Link to={`/app/customers/${o.customer?._id}`} className="font-medium text-walnut-800 hover:underline">
                    {o.customer?.name}
                  </Link>
                  <p className="text-sm text-stone-600">{o.customer?.phone}</p>
                  <p className="text-sm text-stone-600">{o.customer?.email}</p>
                </Card>

                <Card title={t('Delivery')}>
                  <DetailList
                    columns={1}
                    items={[
                      { label: 'Method', value: t(label(o.deliveryMethod)) },
                      o.deliveryMethod === 'DELIVERY' && { label: 'Address', value: [o.deliveryAddress?.street, o.deliveryAddress?.city, o.deliveryAddress?.region].filter(Boolean).join(', ') || '—' },
                      { label: 'Contact phone', value: o.contactPhone || '—' },
                      { label: 'Expected completion', value: date(o.expectedCompletionDate) },
                      { label: 'Delivery status', value: <StatusBadge status={o.deliveryStatus} /> },
                    ]}
                  />
                  {o.deliveries?.map((d) => (
                    <Link key={d._id} to={`/app/deliveries/${d._id}`} className="mt-3 flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 text-sm hover:bg-stone-50">
                      <span>
                        {d.deliveryNumber} · {date(d.scheduledDate)}
                      </span>
                      <StatusBadge status={d.status} />
                    </Link>
                  ))}
                </Card>

                {(o.notes || o.internalNotes) && (
                  <Card title={t('Notes')}>
                    {o.notes && <p className="text-sm text-stone-700">{o.notes}</p>}
                    {o.internalNotes && <p className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-900">Internal: {o.internalNotes}</p>}
                  </Card>
                )}

                {open && !['OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status) && can('orders:write') && (
                  <Button variant="ghost" icon={XCircle} className="text-red-600" onClick={() => setModal('cancel')}>
                    {t('Cancel order')}
                  </Button>
                )}
              </div>
            </div>

            <CustomerPaymentModal open={modal === 'pay'} onClose={() => setModal(null)} order={o} />
            <DiscountModal open={modal === 'discount'} onClose={() => setModal(null)} order={o} />
            <RefundModal open={modal === 'refund'} onClose={() => setModal(null)} order={o} />
            <ScheduleDeliveryModal open={modal === 'delivery'} onClose={() => setModal(null)} order={o} />
            <EditItemsModal open={modal === 'items'} onClose={() => setModal(null)} order={o} />
            <ConfirmDialog
              open={modal === 'cancel'}
              onClose={() => setModal(null)}
              title={`Cancel ${o.orderNumber}?`}
              message={o.amountPaid > 0 ? `The customer has paid ${money(o.amountPaid)}. Record a refund afterwards if needed.` : 'Stock reserved for this order will be returned.'}
              confirmLabel={t('Cancel order')}
              requireReason
              loading={cancel.isPending}
              onConfirm={(reason) => cancel.mutate(reason)}
            />
            <ConfirmDialog
              open={modal === 'collected'}
              onClose={() => setModal(null)}
              tone="primary"
              title={t('Mark as collected?')}
              message={o.balance > 0 ? `Warning: ${money(o.balance)} is still outstanding.` : 'The customer has collected their furniture.'}
              confirmLabel={t('Mark collected')}
              loading={status.isPending}
              onConfirm={() => status.mutate({ status: 'DELIVERED', note: 'Collected from showroom' })}
            />
          </div>
        );
      }}
    </QueryState>
  );
}
