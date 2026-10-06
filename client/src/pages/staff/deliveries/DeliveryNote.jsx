import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { QueryState } from '../../../components/ui/States';
import { DocumentHeader } from '../../shared/InvoiceView';
import { usePublicSettings } from '../../../components/SettingsLoader';
import { deliveriesApi } from '../../../api/endpoints';
import { fileUrl } from '../../../api/client';
import { date, dateTime, warrantyLabel } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

function SignatureBlock({ title, name, image, at }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</p>
      <div className="mt-2 flex h-24 items-end border-b border-stone-400">{image && <img src={fileUrl(image)} alt="" className="max-h-20" />}</div>
      <div className="mt-2 grid grid-cols-2 gap-4 text-xs text-stone-600">
        <p>
          Name: <span className="font-medium text-stone-900">{name || '______________________'}</span>
        </p>
        <p>Date: {at ? dateTime(at) : '____ / ____ / ________'}</p>
      </div>
    </div>
  );
}

/** One-page note the driver or installer carries; the customer signs it on receipt. */
export default function DeliveryNote() {
  const t = useT();
  const { id } = useParams();
  const query = useQuery({ queryKey: ['delivery', id], queryFn: () => deliveriesApi.get(id) });
  const { data: settings } = usePublicSettings();
  const company = { address: settings?.companyAddress, phone: settings?.companyPhone, email: settings?.companyEmail };

  return (
    <QueryState query={query}>
      {(d) => {
        const address = [d.address?.street, d.address?.city, d.address?.region].filter(Boolean).join(', ');
        return (
          <div className="mx-auto max-w-3xl">
            <div className="no-print mb-4 flex justify-between">
              <Button to={`/app/deliveries/${id}`} variant="ghost" size="sm">
                ← Back
              </Button>
              <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
                {t('Print / Save PDF')}
              </Button>
            </div>
            <article className="card p-6 sm:p-10">
              <DocumentHeader company={company} title={t('Delivery note')} number={d.deliveryNumber} />
              <div className="grid gap-6 py-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t('Deliver to')}</p>
                  <p className="mt-1 font-medium">{d.customer?.name}</p>
                  <p className="text-sm text-stone-600">{d.phone || d.customer?.phone}</p>
                  <p className="text-sm text-stone-600">{address || '—'}</p>
                </div>
                <div className="space-y-0.5 text-sm sm:text-right">
                  <p>
                    <span className="text-stone-500">{t('Order:')}</span> {d.order?.orderNumber}
                  </p>
                  <p>
                    <span className="text-stone-500">{t('Scheduled:')}</span> {d.scheduledDate ? date(d.scheduledDate) : '—'}
                  </p>
                  <p>
                    <span className="text-stone-500">{t('Driver / installer:')}</span> {d.deliveryPerson?.name || '—'}
                  </p>
                  {d.vehicle && (
                    <p>
                      <span className="text-stone-500">{t('Vehicle:')}</span> {d.vehicle}
                    </p>
                  )}
                </div>
              </div>

              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-y border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                    <th className="py-2">{t('Item')}</th>
                    <th className="py-2 text-right">{t('Qty')}</th>
                    <th className="w-24 py-2 text-center">{t('Checked')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {(d.order?.items || []).map((item, i) => (
                    <tr key={i}>
                      <td className="py-2.5">
                        <span className="font-medium">{item.name}</span>
                        {[item.color, item.size, item.options].filter(Boolean).length > 0 && (
                          <span className="block text-xs text-stone-500">{[item.color, item.size, item.options].filter(Boolean).join(' · ')}</span>
                        )}
                        {item.warrantyMonths > 0 && <span className="block text-xs text-stone-500">{warrantyLabel(item.warrantyMonths)}</span>}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
                      <td className="py-2.5 text-center">
                        <span className="inline-block h-4 w-4 rounded border border-stone-400" aria-hidden />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {d.notes && (
                <div className="mt-6 rounded-lg bg-stone-50 p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t('Instructions')}</p>
                  <p className="mt-1 whitespace-pre-line">{d.notes}</p>
                </div>
              )}

              <p className="mt-8 text-sm text-stone-700">
                {t('I confirm that I received the items above complete and in good condition, and that they were assembled / installed as agreed.')}
              </p>
              <div className="mt-6 grid gap-10 sm:grid-cols-2">
                <SignatureBlock title={t('Received by (customer)')} name={d.receivedBy} image={d.signatureImage} at={d.deliveredAt} />
                <SignatureBlock title={t('Delivered by (Wan Ofi)')} name={d.deliveryPerson?.name} />
              </div>
              <p className="mt-8 text-center text-xs text-stone-500">{t('Please report any damage within 48 hours of delivery. Keep this note with your invoice for warranty claims.')}</p>
            </article>
          </div>
        );
      }}
    </QueryState>
  );
}
