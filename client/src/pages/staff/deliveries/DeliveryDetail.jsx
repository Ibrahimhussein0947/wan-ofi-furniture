import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, MapPin, Navigation, Phone, Truck, XCircle, Upload, Printer } from 'lucide-react';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import Modal from '../../../components/ui/Modal';
import { Card, DetailList, PageHeader } from '../../../components/ui/misc';
import { StatusBadge } from '../../../components/ui/Badge';
import { QueryState } from '../../../components/ui/States';
import { Input } from '../../../components/ui/Field';
import ImagePicker from '../../../components/ui/ImagePicker';
import SignaturePad from '../../../components/SignaturePad';
import { deliveriesApi } from '../../../api/endpoints';
import { fileUrl } from '../../../api/client';
import useMutationToast from '../../../hooks/useMutationToast';
import { date, dateTime, label, money, toInputDate } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

const KEYS = ['delivery', 'deliveries', 'order', 'orders', 'dashboard'];

export default function DeliveryDetail() {
  const t = useT();
  const { id } = useParams();
  const [modal, setModal] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [signature, setSignature] = useState(null);
  const [receivedBy, setReceivedBy] = useState('');
  const [newDate, setNewDate] = useState(toInputDate(new Date(Date.now() + 86400000)));
  const query = useQuery({ queryKey: ['delivery', id], queryFn: () => deliveriesApi.get(id) });

  const update = useMutationToast((body) => deliveriesApi.update(id, body), { success: (d) => `Delivery ${t(label(d.status)).toLowerCase()}`, invalidate: KEYS, onSuccess: () => setModal(null) });

  const complete = useMutationToast(
    async () => {
      if (signature) await deliveriesApi.proof(id, [signature, ...photos], { kind: 'signature', receivedBy });
      else if (photos.length) await deliveriesApi.proof(id, photos, { receivedBy });
      return deliveriesApi.update(id, { status: 'DELIVERED', receivedBy: receivedBy || undefined });
    },
    { success: 'Marked as delivered', invalidate: KEYS, onSuccess: () => setModal(null) }
  );

  return (
    <QueryState query={query}>
      {(d) => {
        const address = [d.address?.street, d.address?.city, d.address?.region].filter(Boolean).join(', ');
        return (
          <div className="mx-auto max-w-4xl space-y-6">
            <PageHeader
              back="/app/deliveries"
              title={`Delivery ${d.deliveryNumber}`}
              subtitle={<StatusBadge status={d.status} />}
              actions={
                <Button to={`/app/deliveries/${d._id}/note`} variant="secondary" icon={Printer}>
                  {t('Delivery note')}
                </Button>
              }
            />

            {/* Large action buttons for drivers on their phones */}
            <div className="grid gap-3 sm:grid-cols-2">
              {['PENDING', 'FAILED'].includes(d.status) && (
                <Button size="xl" icon={Truck} onClick={() => setModal('schedule')}>
                  {d.status === 'FAILED' ? 'Reschedule' : 'Schedule'}
                </Button>
              )}
              {d.status === 'SCHEDULED' && (
                <Button size="xl" icon={Truck} loading={update.isPending} onClick={() => update.mutate({ status: 'OUT_FOR_DELIVERY' })}>
                  {t('Start delivery')}
                </Button>
              )}
              {d.status === 'OUT_FOR_DELIVERY' && (
                <Button size="xl" variant="success" icon={CheckCircle2} onClick={() => setModal('complete')}>
                  {t('Delivered')}
                </Button>
              )}
              {['SCHEDULED', 'OUT_FOR_DELIVERY'].includes(d.status) && (
                <Button size="xl" variant="secondary" icon={XCircle} onClick={() => setModal('fail')}>
                  {t('Delivery failed')}
                </Button>
              )}
            </div>
            {d.order?.balance > 0 && d.status === 'SCHEDULED' && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Balance of {money(d.order.balance)} must be paid before dispatch.</p>}

            <div className="grid gap-6 md:grid-cols-2">
              <Card title={t('Customer & address')}>
                <p className="font-semibold">{d.customer?.name}</p>
                <p className="mt-2 flex items-start gap-2 text-sm text-stone-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brass-600" /> {address || 'No address'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(d.phone || d.customer?.phone) && (
                    <Button href={`tel:${d.phone || d.customer?.phone}`} variant="secondary" icon={Phone}>
                      Call {d.phone || d.customer?.phone}
                    </Button>
                  )}
                  {address && (
                    <Button href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" variant="secondary" icon={Navigation}>
                      {t('Directions')}
                    </Button>
                  )}
                </div>
              </Card>
              <Card title={t('Details')}>
                <DetailList
                  columns={1}
                  items={[
                    { label: 'Order', value: <Link to={`/app/orders/${d.order?._id}`} className="link">{d.order?.orderNumber}</Link> },
                    { label: 'Scheduled', value: date(d.scheduledDate) },
                    { label: 'Delivery person', value: d.deliveryPerson?.name || 'Unassigned' },
                    { label: 'Vehicle', value: d.vehicle || '—' },
                    { label: 'Balance on order', value: money(d.order?.balance) },
                    d.receivedBy && { label: 'Received by', value: d.receivedBy },
                    d.failureReason && { label: 'Failure reason', value: d.failureReason },
                    d.notes && { label: 'Notes', value: d.notes },
                  ]}
                />
              </Card>
            </div>

            <Card title={t('Items')}>
              <ul className="space-y-1 text-sm">
                {d.order?.items?.map((i) => (
                  <li key={i._id}>
                    {i.quantity} × {i.name} {i.color && <span className="text-stone-500">({i.color})</span>}
                  </li>
                ))}
              </ul>
            </Card>

            {(d.proofImages?.length > 0 || d.signatureImage) && (
              <Card title={t('Proof of delivery')}>
                <div className="flex flex-wrap gap-3">
                  {d.signatureImage && <img src={fileUrl(d.signatureImage)} alt="Customer signature" className="h-28 rounded-lg border border-stone-200 bg-white p-1" />}
                  {d.proofImages.map((src) => (
                    <a key={src} href={fileUrl(src)} target="_blank" rel="noreferrer">
                      <img src={fileUrl(src)} alt={t('Proof of delivery')} className="h-28 w-28 rounded-lg object-cover" />
                    </a>
                  ))}
                </div>
              </Card>
            )}

            <Card title={t('History')}>
              <ol className="space-y-2 text-sm">
                {d.history.map((h, i) => (
                  <li key={i}>
                    <span className="font-medium">{t(label(h.status))}</span> · {dateTime(h.at)} {h.by?.name && `· ${h.by.name}`} {h.note && `— ${h.note}`}
                  </li>
                ))}
              </ol>
            </Card>

            <Modal
              open={modal === 'complete'}
              onClose={() => setModal(null)}
              title={t('Confirm delivery')}
              footer={
                <>
                  <Button variant="secondary" onClick={() => setModal(null)}>
                    {t('Cancel')}
                  </Button>
                  <Button variant="success" icon={Upload} loading={complete.isPending} onClick={() => complete.mutate()}>
                    {t('Confirm delivered')}
                  </Button>
                </>
              }
            >
              <div className="space-y-4">
                <Input label={t('Received by')} value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder={t('Name of the person who received it')} />
                <div>
                  <p className="label">{t('Signature')}</p>
                  <SignaturePad onChange={setSignature} />
                </div>
                <div>
                  <p className="label">{t('Photos')}</p>
                  <ImagePicker files={photos} onChange={setPhotos} max={5} capture label={t('Take photo')} />
                </div>
              </div>
            </Modal>
            <ConfirmDialog open={modal === 'fail'} onClose={() => setModal(null)} title={t('Delivery failed')} message="The order returns to 'Ready' so it can be rescheduled." confirmLabel={t('Mark failed')} requireReason loading={update.isPending} onConfirm={(failureReason) => update.mutate({ status: 'FAILED', failureReason })} />
            <Modal
              open={modal === 'schedule'}
              onClose={() => setModal(null)}
              title={t('Schedule delivery')}
              size="sm"
              footer={
                <Button loading={update.isPending} onClick={() => update.mutate({ status: 'SCHEDULED', scheduledDate: newDate })}>
                  {t('Save')}
                </Button>
              }
            >
              <Input label={t('Delivery date')} type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </Modal>
          </div>
        );
      }}
    </QueryState>
  );
}
