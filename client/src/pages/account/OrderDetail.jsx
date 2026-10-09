import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, FileText, MessageSquare, PartyPopper, Upload, XCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Card, PageHeader, ProgressBar } from '../../components/ui/misc';
import { StatusBadge } from '../../components/ui/Badge';
import { QueryState } from '../../components/ui/States';
import OrderTimeline from '../../components/OrderTimeline';
import ProductImage from '../../components/ProductImage';
import PayModal from './PayModal';
import AddReceiptModal from './AddReceiptModal';
import BankAccounts from '../../components/BankAccounts';
import { usePublicSettings } from '../../components/SettingsLoader';
import { invoicesApi, messagesApi, ordersApi } from '../../api/endpoints';
import { fileUrl } from '../../api/client';
import useMutationToast from '../../hooks/useMutationToast';
import { date, dateTime, label, money } from '../../utils/format';
import { useT } from '../../i18n/LanguageContext';


// What the customer should pay next: the rest of the deposit while pending, otherwise the balance.
const due = (o) => (o.status === 'PENDING' ? Math.max(o.depositRequired - o.amountPaid, 0) || o.balance : o.balance);

export default function OrderDetail() {
  const t = useT();
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [receiptFor, setReceiptFor] = useState(null);
  const { data: settings } = usePublicSettings();
  const hasAccounts = (settings?.bankAccounts || []).length > 0;
  const [cancelling, setCancelling] = useState(false);
  const query = useQuery({ queryKey: ['order', id], queryFn: () => ordersApi.get(id) });

  const cancel = useMutationToast((reason) => ordersApi.action(id, 'cancel', { reason }), { success: 'Order cancelled', invalidate: ['order', 'orders', 'dashboard'], onSuccess: () => setCancelling(false) });
  const invoice = useMutationToast(() => invoicesApi.create({ order: id }), { onSuccess: (inv) => navigate(`/account/invoices/${inv._id}`) });
  const contact = useMutationToast((body) => messagesApi.send(body), { success: 'Message sent to our team', onSuccess: () => navigate('/account/messages') });

  return (
    <QueryState query={query}>
      {(o) => {
        const canPay = o.balance > 0 && o.status !== 'CANCELLED' && hasAccounts;
        const payNow = canPay && Boolean(params.get('new'));
        return (
        <div className="space-y-6">
          {params.get('new') && (
            <div className="rounded-xl bg-sage-50 p-4 text-sage-700">
              <div className="flex items-start gap-3">
                <PartyPopper className="h-5 w-5 shrink-0" />
                <p className="text-sm">
                  {t('Thank you! Your order has been placed. Pay the deposit of {amount} to confirm it and start production.', { amount: money(o.depositRequired) })}
                </p>
              </div>
              {/* Right after ordering, put the accounts and the upload step first — not down the page. */}
              {payNow && (
                <div className="mt-4 rounded-lg bg-white p-4 text-stone-800 shadow-sm">
                  <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">
                    <li>{t('Transfer {amount} to one of the accounts below.', { amount: money(due(o)) })}</li>
                    <li>{t('Upload your receipt and the transaction reference so we can confirm your payment.')}</li>
                  </ol>
                  <BankAccounts title={null} listClassName="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" />
                  <Button icon={Upload} className="mt-4" onClick={() => setPaying('manual')}>
                    {t("I've paid — upload receipt")}
                  </Button>
                </div>
              )}
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
                    {t('Invoice')}
                  </Button>
                )}
                {o.status === 'PENDING' && (
                  <Button variant="ghost" icon={XCircle} onClick={() => setCancelling(true)}>
                    {t('Cancel')}
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
              <Card title={t('Items')} padded={false}>
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
                <Card title={t('Production progress')}>
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
                                <img src={fileUrl(img.url)} alt={`Progress: ${t(label(img.stage))}`} className="h-20 w-20 rounded-lg object-cover" />
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
                <Card title={t('Delivery')}>
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
              {canPay && !payNow && (
                <Card title={t('How to pay')}>
                  <p className="mb-3 text-sm text-stone-600">
                    {t('Transfer {amount} to one of our accounts, then upload your receipt and the transaction reference.', {
                      amount: money(due(o)),
                    })}
                  </p>
                  <BankAccounts title={null} compact />
                  <Button block icon={Upload} className="mt-4" onClick={() => setPaying('manual')}>
                    {t("I've paid — upload receipt")}
                  </Button>
                </Card>
              )}
              <Card title={t('Payment')}>
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
                    <dt>{t('Balance')}</dt>
                    <dd className="tabular-nums">{money(o.balance)}</dd>
                  </div>
                </dl>
                <StatusBadge status={o.paymentStatus} className="mt-3" />
                {o.payments?.length > 0 && (
                  <ul className="mt-4 space-y-2 border-t border-stone-100 pt-4 text-sm">
                    {o.payments.map((p) => (
                      <li key={p._id} className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          {dateTime(p.paidAt)}
                          <span className="block text-xs text-stone-500">
                            {t(label(p.method))}
                            {p.reference && ` · ${t('Ref')} ${p.reference}`}
                          </span>
                          {p.screenshot && (
                            <a href={fileUrl(p.screenshot)} target="_blank" rel="noreferrer" className="text-xs text-walnut-700 hover:underline">
                              {t('Your receipt')}
                            </a>
                          )}
                          {p.status === 'PENDING_VERIFICATION' && (
                            <button type="button" className="block text-xs font-medium text-brass-700 hover:underline" onClick={() => setReceiptFor(p)}>
                              {p.screenshot ? t('Replace receipt') : t('Add receipt')}
                            </button>
                          )}
                          {p.status === 'PENDING_VERIFICATION' && <span className="block text-xs text-amber-700">{t('Our accounts team is checking this payment.')}</span>}
                          {p.status === 'REJECTED' && (
                            <span className="block text-xs text-red-600">
                              {t('Not verified')}
                              {p.rejectionReason && `: ${p.rejectionReason}`}
                            </span>
                          )}
                        </span>
                        <span className="text-right">
                          <span className="block tabular-nums">{money(p.amount)}</span>
                          {p.status === 'COMPLETED' && p.receiptNumber ? (
                            <Link to={`/account/receipts/${p._id}`} className="text-xs text-walnut-700 hover:underline">
                              {t('Receipt')}
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

              <Card title={t('Delivery details')}>
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
                  {t('Ask about this order')}
                </Button>
              </Card>
            </div>
          </div>

          <PayModal order={o} open={Boolean(paying)} initialTab={paying === 'manual' ? 'manual' : undefined} onClose={() => setPaying(false)} />
          <AddReceiptModal payment={receiptFor} onClose={() => setReceiptFor(null)} />
          <ConfirmDialog
            open={cancelling}
            onClose={() => setCancelling(false)}
            title={t('Cancel this order?')}
            message="You can cancel while the order is awaiting its deposit."
            confirmLabel={t('Cancel order')}
            requireReason
            loading={cancel.isPending}
            onConfirm={(reason) => cancel.mutate(reason)}
          />
        </div>
        );
      }}
    </QueryState>
  );
}
