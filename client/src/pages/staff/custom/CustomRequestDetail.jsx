import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Calculator, Eye, Send, XCircle } from 'lucide-react';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { Card, DetailList, PageHeader } from '../../../components/ui/misc';
import { StatusBadge } from '../../../components/ui/Badge';
import { QueryState } from '../../../components/ui/States';
import { Input, Textarea } from '../../../components/ui/Field';
import { customOrdersApi } from '../../../api/endpoints';
import { fileUrl } from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import useMutationToast from '../../../hooks/useMutationToast';
import { usePublicSettings } from '../../../components/SettingsLoader';
import { date, dateTime, label, money, toInputDate } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

const OPEN = ['SUBMITTED', 'UNDER_REVIEW', 'ESTIMATED', 'QUOTED'];

function EstimateQuoteForms({ r }) {
  const t = useT();
  const { data: settings } = usePublicSettings();
  const keys = ['custom-order', 'custom-orders'];
  const est = useForm({
    values: {
      materialCost: r.estimate?.materialCost || 0,
      laborCost: r.estimate?.laborCost || 0,
      otherCost: r.estimate?.otherCost || 0,
      productionDays: r.estimate?.productionDays || 14,
      notes: r.estimate?.notes || '',
    },
  });
  const [m, l, o] = est.watch(['materialCost', 'laborCost', 'otherCost']);
  const totalCost = Number(m || 0) + Number(l || 0) + Number(o || 0);

  const quote = useForm({
    values: {
      quotedPrice: r.quotedPrice || Math.round((r.estimate?.totalCost || 0) * 1.35) || '',
      depositRequired: r.depositRequired || '',
      quoteValidUntil: toInputDate(r.quoteValidUntil || new Date(Date.now() + 14 * 86400000)),
      quoteNotes: r.quoteNotes || '',
    },
  });
  const price = Number(quote.watch('quotedPrice') || 0);
  const cost = r.estimate?.totalCost || totalCost;

  const saveEstimate = useMutationToast((body) => customOrdersApi.action(r._id, 'estimate', body), { success: 'Estimate saved', invalidate: keys });
  const sendQuote = useMutationToast((body) => customOrdersApi.action(r._id, 'quote', body), { success: 'Quote sent to the customer', invalidate: keys });

  return (
    <>
      <Card title={t('Estimate')} subtitle={t('Internal only — never shown to the customer')}>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={est.handleSubmit((v) => saveEstimate.mutate({ ...v, materialCost: Number(v.materialCost), laborCost: Number(v.laborCost), otherCost: Number(v.otherCost), productionDays: Number(v.productionDays) }))}
        >
          <Input label={t('Material cost')} type="number" min="0" {...est.register('materialCost')} />
          <Input label={t('Labour cost')} type="number" min="0" {...est.register('laborCost')} />
          <Input label={t('Other costs')} type="number" min="0" {...est.register('otherCost')} />
          <Input label={t('Production days')} type="number" min="1" {...est.register('productionDays')} />
          <Textarea label={t('Estimate notes')} containerClassName="sm:col-span-2" rows={2} {...est.register('notes')} />
          <div className="flex items-center justify-between sm:col-span-2">
            <p className="text-sm">
              {t('Estimated cost:')} <strong>{money(totalCost)}</strong>
            </p>
            <Button type="submit" variant="secondary" icon={Calculator} loading={saveEstimate.isPending}>
              {t('Save estimate')}
            </Button>
          </div>
        </form>
      </Card>
      <Card title={t('Price proposal')}>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={quote.handleSubmit((v) =>
            sendQuote.mutate({
              quotedPrice: Number(v.quotedPrice),
              depositRequired: v.depositRequired === '' ? undefined : Number(v.depositRequired),
              quoteValidUntil: v.quoteValidUntil,
              quoteNotes: v.quoteNotes,
              productionDays: Number(est.getValues('productionDays')) || undefined,
            })
          )}
        >
          <Input label={t('Quoted price (total)')} type="number" min="1" required {...quote.register('quotedPrice', { required: true })} />
          <Input label={t('Deposit required')} type="number" min="0" placeholder={`Default ${settings?.depositPercent ?? 40}%: ${money((price * (settings?.depositPercent ?? 40)) / 100)}`} {...quote.register('depositRequired')} />
          <Input label={t('Valid until')} type="date" {...quote.register('quoteValidUntil')} />
          <div className="rounded-lg bg-stone-50 p-3 text-sm">
            {t('Margin:')} <strong className={price - cost < 0 ? 'text-red-600' : 'text-emerald-700'}>{money(price - cost)}</strong>
            {price > 0 && ` (${Math.round(((price - cost) / price) * 100)}%)`}
          </div>
          <Textarea label={t('Message to customer')} containerClassName="sm:col-span-2" rows={3} placeholder="What's included, delivery, warranty…" {...quote.register('quoteNotes')} />
          <div className="sm:col-span-2">
            <Button type="submit" icon={Send} loading={sendQuote.isPending}>
              {r.status === 'QUOTED' ? 'Update quote' : 'Send quote to customer'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

export default function CustomRequestDetail() {
  const t = useT();
  const { id } = useParams();
  const { can } = useAuth();
  const [rejecting, setRejecting] = useState(false);
  const query = useQuery({ queryKey: ['custom-order', id], queryFn: () => customOrdersApi.get(id) });
  const review = useMutationToast(() => customOrdersApi.action(id, 'review', {}), { success: 'Marked as under review', invalidate: ['custom-order', 'custom-orders'] });
  const reject = useMutationToast((reason) => customOrdersApi.action(id, 'reject', { reason }), { success: 'Request rejected', invalidate: ['custom-order', 'custom-orders'], onSuccess: () => setRejecting(false) });
  const manage = can('custom-requests:manage');

  return (
    <QueryState query={query}>
      {(r) => {
        const d = r.dimensions || {};
        const dims = ['width', 'height', 'length', 'depth'].filter((k) => d[k]).map((k) => `${t(label(k))} ${d[k]}`).join(' × ');
        return (
          <div className="space-y-6">
            <PageHeader
              back="/app/custom-orders"
              title={`${r.furnitureType} × ${r.quantity}`}
              subtitle={
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.status} /> {r.requestNumber} · received {dateTime(r.createdAt)}
                </span>
              }
              actions={
                manage &&
                OPEN.includes(r.status) && (
                  <>
                    {r.status === 'SUBMITTED' && (
                      <Button variant="secondary" icon={Eye} loading={review.isPending} onClick={() => review.mutate()}>
                        {t('Start review')}
                      </Button>
                    )}
                    <Button variant="ghost" icon={XCircle} className="text-red-600" onClick={() => setRejecting(true)}>
                      {t('Reject')}
                    </Button>
                  </>
                )
              }
            />
            {r.order && (
              <Card>
                <p className="text-sm">
                  Converted to order{' '}
                  <Link to={`/app/orders/${r.order._id}`} className="link">
                    {r.order.orderNumber}
                  </Link>{' '}
                  · <StatusBadge status={r.order.status} /> · balance {money(r.order.balance)}
                </p>
              </Card>
            )}
            <div className="grid gap-6 xl:grid-cols-3">
              <div className="space-y-6 xl:col-span-2">
                <Card title={t('Customer requirements')}>
                  <p className="whitespace-pre-wrap text-sm text-stone-700">{r.description}</p>
                  {r.designRequirements && <p className="mt-3 whitespace-pre-wrap text-sm text-stone-700"><strong>{t('Design:')}</strong> {r.designRequirements}</p>}
                  <div className="mt-5">
                    <DetailList
                      columns={3}
                      items={[
                        { label: 'Dimensions', value: dims ? `${dims} ${d.unit || ''}` : '—' },
                        { label: 'Material', value: r.preferredMaterial || '—' },
                        { label: 'Colour', value: r.preferredColor || '—' },
                        { label: 'Fabric', value: r.fabric || '—' },
                        { label: 'Budget', value: r.budget ? money(r.budget) : '—' },
                        { label: 'Needed by', value: date(r.requiredDate) },
                        { label: 'Delivery', value: t(label(r.deliveryMethod)) },
                        { label: 'Notes', value: r.additionalNotes || '—' },
                      ]}
                    />
                  </div>
                  {r.referenceImages?.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-3">
                      {r.referenceImages.map((src) => (
                        <a key={src} href={fileUrl(src)} target="_blank" rel="noreferrer">
                          <img src={fileUrl(src)} alt="Customer reference" className="h-28 w-28 rounded-lg object-cover ring-1 ring-stone-200" />
                        </a>
                      ))}
                    </div>
                  )}
                </Card>
                {manage && OPEN.includes(r.status) && <EstimateQuoteForms r={r} />}
                {!OPEN.includes(r.status) && r.quotedPrice && (
                  <Card title={t('Quote')}>
                    <DetailList items={[{ label: 'Quoted price', value: money(r.quotedPrice) }, { label: 'Deposit', value: money(r.depositRequired) }, { label: 'Estimated cost', value: money(r.estimate?.totalCost) }, { label: 'Customer note', value: r.customerResponseNote || '—' }]} />
                  </Card>
                )}
              </div>
              <div className="space-y-6">
                <Card title={t('Customer')}>
                  <p className="font-medium">{r.customer?.name}</p>
                  <p className="text-sm text-stone-600">{r.customer?.phone}</p>
                  <p className="text-sm text-stone-600">{r.customer?.email}</p>
                </Card>
                <Card title={t('History')}>
                  <ol className="space-y-3 border-l-2 border-walnut-100 pl-4">
                    {r.history.map((h, i) => (
                      <li key={i} className="relative text-sm">
                        <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-walnut-600" />
                        <span className="font-medium">{t(label(h.status))}</span>
                        {h.note && <p className="text-stone-600">{h.note}</p>}
                        <p className="text-xs text-stone-500">
                          {dateTime(h.at)} {h.by?.name && `· ${h.by.name}`}
                        </p>
                      </li>
                    ))}
                  </ol>
                </Card>
              </div>
            </div>
            <ConfirmDialog open={rejecting} onClose={() => setRejecting(false)} title={t('Reject this request?')} message={t('The customer will be notified with your reason.')} confirmLabel={t('Reject request')} requireReason loading={reject.isPending} onConfirm={(reason) => reject.mutate(reason)} />
          </div>
        );
      }}
    </QueryState>
  );
}
