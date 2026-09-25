import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, FileText, MessageSquare, PartyPopper, XCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Card, PageHeader, ProgressBar } from '../../components/ui/misc';
import { StatusBadge } from '../../components/ui/Badge';
import { QueryState } from '../../components/ui/States';
import OrderTimeline from '../../components/OrderTimeline';
import ProductImage from '../../components/ProductImage';
import PayModal from './PayModal';
import { invoicesApi, messagesApi, ordersApi } from '../../api/endpoints';
import { fileUrl } from '../../api/client';
import useMutationToast from '../../hooks/useMutationToast';
import { date, dateTime, label, money } from '../../utils/format';


export default function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const query = useQuery({ queryKey: ['order', id], queryFn: () => ordersApi.get(id) });

  const cancel = useMutationToast((reason) => ordersApi.action(id, 'cancel', { reason }), { success: 'Order cancelled', invalidate: ['order', 'orders', 'dashboard'], onSuccess: () => setCancelling(false) });
  const invoice = useMutationToast(() => invoicesApi.create({ order: id }), { onSuccess: (inv) => navigate(`/account/invoices/${inv._id}`) });
  const contact = useMutationToast((body) => messagesApi.send(body), { success: 'Message sent to our team', onSuccess: () => navigate('/account/messages') });

  return (
    <QueryState query={query}>
      {(o) => (
        <div className="space-y-6">
          {params.get('new') && (
            <div className="flex items-start gap-3 rounded-xl bg-sage-50 p-4 text-sage-700">
              <PartyPopper className="h-5 w-5 shrink-0" />
              <p className="text-sm">
                Thank you! Your order has been placed. Pay the deposit of <strong>{money(o.depositRequired)}</strong> to confirm it and start production.
              </p>
            </div>
          )}
          <PageHeader
            back="/account/orders"
            title={`Order ${o.orderNumber}`}
            subtitle={`Placed ${date(o.orderDate)}`}
            actions={
              <>
                {o.balance > 0 && o.status !== 'CANCELLED' && (
                  <Button icon={CreditCard} onClick={() => setPaying(true)}>
                    Pay {o.status === 'PENDING' ? 'deposit' : 'balance'}
                  </Button>
                )}
                {o.status !== 'CANCELLED' && (
                  <Button variant="secondary" icon={FileText} loading={invoice.isPending} onClick={() => (o.invoices?.[0] ? navigate(`/account/invoices/${o.invoices[0]._id}`) : invoice.mutate())}>
                    Invoice
                  </Button>
                )}
                {o.status === 'PENDING' && (
                  <Button variant="ghost" icon={XCircle} onClick={() => setCancelling(true)}>
                    Cancel
                  </Button>
                )}
              </>
            }
          />

          <Card>
            <OrderTimeline order={o} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card title="Items" padded={false}>
                <ul className="divide-y divide-stone-100">
                  {o.items.map((i) => (
                    <li key={i._id} className="flex gap-4 p-4">
                      <ProductImage src={i.image} name={i.name} className="h-16 w-16 shrink-0 rounded-lg" iconClassName="h-6 w-6" />
                      <div className="flex-1">
                        <p className="font-medium">{i.name}</p>
                        <p className="text-sm text-stone-500">{[i.color, i.size, i.options].filter(Boolean).join(' · ')}</p>
                        <p className="text-sm text-stone-500">
                          {i.quantity} × {money(i.unitPrice)}
                        </p>
                      </div>
                      <p className="font-medium tabular-nums">{money(i.lineTotal)}</p>
                    </li>
                  ))}
                </ul>
              </Card>

              {o.production?.length > 0 && (
                <Card title="Production progress">
                  <div className="space-y-5">
                    {o.production.map((job) => (
                      <div key={job._id}>
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{job.title}</p>
                          <StatusBadge status={job.stage} />
                        </div>
                        <ProgressBar value={job.progress} showLabel tone={job.progress >= 100 ? 'green' : 'walnut'} />
                        {job.images?.length > 0 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto">
                            {job.images.map((img) => (
                              <a key={img.url} href={fileUrl(img.url)} target="_blank" rel="noreferrer" className="shrink-0">
                                <img src={fileUrl(img.url)} alt={`Progress: ${label(img.stage)}`} className="h-20 w-20 rounded-lg object-cover" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {o.deliveries?.length > 0 && (
                <Card title="Delivery">
                  {o.deliveries.map((d) => (
                    <div key={d._id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        {d.scheduledDate ? `Scheduled for ${date(d.scheduledDate)}` : 'Being scheduled'}
                        {d.deliveryPerson && ` · ${d.deliveryPerson.name}`}
                      </span>
                      <StatusBadge status={d.status} />
                    </div>
                  ))}
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card title="Payment">
                <dl className="space-y-2 text-sm">
                  {[
                    ['Subtotal', o.subtotal],
                    o.discount > 0 && ['Discount', -o.discount],
                    o.tax > 0 && [`VAT (${o.taxRate}%)`, o.tax],
                    ['Delivery', o.deliveryFee],
                    ['Total', o.total],
                    ['Paid', o.amountPaid],
                  ]
                    .filter(Boolean)
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt className="text-stone-600">{k}</dt>
                        <dd className="tabular-nums">{money(v)}</dd>
                      </div>
                    ))}
                  <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-semibold">
                    <dt>Balance</dt>
                    <dd className="tabular-nums">{money(o.balance)}</dd>
                  </div>
                </dl>
                <StatusBadge status={o.paymentStatus} className="mt-3" />
                {o.payments?.length > 0 && (
                  <ul className="mt-4 space-y-2 border-t border-stone-100 pt-4 text-sm">
                    {o.payments.map((p) => (
                      <li key={p._id} className="flex items-center justify-between gap-2">
                        <span>
                          {dateTime(p.paidAt)}
                          <span className="block text-xs text-stone-500">{label(p.method)}</span>
                        </span>
                        <span className="text-right">
                          <span className="block tabular-nums">{money(p.amount)}</span>
                          {p.status === 'COMPLETED' && p.receiptNumber ? (
                            <Link to={`/account/receipts/${p._id}`} className="text-xs text-walnut-700 hover:underline">
                              Receipt
                            </Link>
                          ) : (
                            <StatusBadge status={p.status} />
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Delivery details">
                <p className="text-sm text-stone-700">{o.deliveryMethod === 'PICKUP' ? 'Collect from our showroom' : [o.deliveryAddress?.street, o.deliveryAddress?.city].filter(Boolean).join(', ')}</p>
                <p className="mt-1 text-sm text-stone-500">Expected ready: {date(o.expectedCompletionDate)}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={MessageSquare}
                  className="mt-4"
                  loading={contact.isPending}
                  onClick={() => contact.mutate({ order: o._id, body: `Hello, I have a question about order ${o.orderNumber}.` })}
                >
                  Ask about this order
                </Button>
              </Card>
            </div>
          </div>

          <PayModal order={o} open={paying} onClose={() => setPaying(false)} />
          <ConfirmDialog
            open={cancelling}
            onClose={() => setCancelling(false)}
            title="Cancel this order?"
            message="You can cancel while the order is awaiting its deposit."
            confirmLabel="Cancel order"
            requireReason
            loading={cancel.isPending}
            onConfirm={(reason) => cancel.mutate(reason)}
          />
        </div>
      )}
    </QueryState>
  );
}
