import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Card, DetailList, PageHeader } from '../../components/ui/misc';
import { StatusBadge } from '../../components/ui/Badge';
import { QueryState } from '../../components/ui/States';
import { customOrdersApi } from '../../api/endpoints';
import { fileUrl } from '../../api/client';
import useMutationToast from '../../hooks/useMutationToast';
import { date, dateTime, label, money } from '../../utils/format';

export default function CustomRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [declining, setDeclining] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const query = useQuery({ queryKey: ['custom-order', id], queryFn: () => customOrdersApi.get(id) });

  const respond = useMutationToast((body) => customOrdersApi.action(id, 'respond', body), {
    success: (_, v) => (v.approve ? 'Quote approved — your order has been created' : 'Quote declined'),
    invalidate: ['custom-order', 'custom-orders', 'dashboard'],
    onSuccess: (data) => {
      setDeclining(false);
      if (data.order) navigate(`/account/orders/${data.order._id}?new=1`);
    },
  });
  const cancel = useMutationToast(() => customOrdersApi.action(id, 'cancel'), { success: 'Request cancelled', invalidate: ['custom-order', 'custom-orders'], onSuccess: () => setCancelling(false) });

  return (
    <QueryState query={query}>
      {(r) => {
        const d = r.dimensions || {};
        const dims = ['width', 'height', 'length', 'depth'].filter((k) => d[k]).map((k) => `${label(k)} ${d[k]}`).join(' × ');
        return (
          <div className="space-y-6">
            <PageHeader
              back="/account/custom-requests"
              title={r.furnitureType}
              subtitle={`${r.requestNumber} · submitted ${date(r.createdAt)}`}
              actions={
                <>
                  <StatusBadge status={r.status} />
                  {['SUBMITTED', 'UNDER_REVIEW', 'ESTIMATED'].includes(r.status) && (
                    <Button variant="ghost" size="sm" onClick={() => setCancelling(true)}>
                      Cancel request
                    </Button>
                  )}
                </>
              }
            />

            {r.status === 'QUOTED' && (
              <div className="rounded-2xl border-2 border-brass-300 bg-brass-50 p-6">
                <p className="text-sm font-semibold uppercase tracking-wide text-brass-700">Your price proposal</p>
                <p className="mt-2 font-display text-4xl font-semibold text-walnut-950">{money(r.quotedPrice)}</p>
                <p className="mt-1 text-sm text-stone-700">
                  Deposit to start production: <strong>{money(r.depositRequired)}</strong>
                  {r.quoteValidUntil && ` · valid until ${date(r.quoteValidUntil)}`}
                </p>
                {r.quoteNotes && <p className="mt-3 text-sm text-stone-700">{r.quoteNotes}</p>}
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button icon={CheckCircle2} loading={respond.isPending} onClick={() => respond.mutate({ approve: true })}>
                    Approve & create order
                  </Button>
                  <Button variant="secondary" icon={XCircle} onClick={() => setDeclining(true)}>
                    Decline
                  </Button>
                </div>
              </div>
            )}
            {r.order && (
              <Card>
                <p className="text-sm">
                  This request became order <strong>{r.order.orderNumber}</strong>.{' '}
                  <Button to={`/account/orders/${r.order._id}`} size="sm" variant="secondary" className="ml-2">
                    View order
                  </Button>
                </p>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
              <Card title="Your request" className="lg:col-span-2">
                <p className="whitespace-pre-wrap text-sm text-stone-700">{r.description}</p>
                <div className="mt-5">
                  <DetailList
                    items={[
                      { label: 'Quantity', value: r.quantity },
                      { label: 'Dimensions', value: dims ? `${dims} ${d.unit || ''}` : '—' },
                      { label: 'Material', value: r.preferredMaterial || '—' },
                      { label: 'Colour', value: r.preferredColor || '—' },
                      { label: 'Fabric', value: r.fabric || '—' },
                      { label: 'Budget', value: r.budget ? money(r.budget) : '—' },
                      { label: 'Needed by', value: date(r.requiredDate) },
                      { label: 'Delivery', value: label(r.deliveryMethod) },
                    ]}
                  />
                </div>
                {r.designRequirements && <p className="mt-4 text-sm text-stone-700"><strong>Design requirements:</strong> {r.designRequirements}</p>}
                {r.referenceImages?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {r.referenceImages.map((src) => (
                      <a key={src} href={fileUrl(src)} target="_blank" rel="noreferrer">
                        <img src={fileUrl(src)} alt="Reference" className="h-24 w-24 rounded-lg object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </Card>
              <Card title="Timeline">
                <ol className="space-y-3 border-l-2 border-walnut-100 pl-4">
                  {r.history.map((h, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-walnut-600" />
                      <p className="text-sm font-medium">{label(h.status)}</p>
                      <p className="text-xs text-stone-500">{dateTime(h.at)}</p>
                    </li>
                  ))}
                </ol>
              </Card>
            </div>

            <ConfirmDialog open={declining} onClose={() => setDeclining(false)} title="Decline this quote?" confirmLabel="Decline quote" requireReason reasonLabel="Tell us why (helps us improve)" loading={respond.isPending} onConfirm={(note) => respond.mutate({ approve: false, note })} />
            <ConfirmDialog open={cancelling} onClose={() => setCancelling(false)} title="Cancel this request?" confirmLabel="Cancel request" loading={cancel.isPending} onConfirm={() => cancel.mutate()} />
          </div>
        );
      }}
    </QueryState>
  );
}
