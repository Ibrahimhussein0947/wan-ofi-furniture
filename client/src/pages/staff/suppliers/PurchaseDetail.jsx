import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Banknote, PackageCheck, Send, XCircle } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { Card, DetailList, PageHeader, ProgressBar } from '../../../components/ui/misc';
import { StatusBadge } from '../../../components/ui/Badge';
import { QueryState } from '../../../components/ui/States';
import { Input } from '../../../components/ui/Field';
import { SupplierPaymentModal } from '../../../components/finance/PaymentModals';
import { purchasesApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import useMutationToast from '../../../hooks/useMutationToast';
import { date, dateTime, label, money, number } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

const KEYS = ['purchase', 'purchases', 'materials', 'inventory', 'supplier'];

export default function PurchaseDetail() {
  const t = useT();
  const { id } = useParams();
  const { can } = useAuth();
  const [modal, setModal] = useState(null);
  const [receipt, setReceipt] = useState({});
  const query = useQuery({ queryKey: ['purchase', id], queryFn: () => purchasesApi.get(id) });

  const place = useMutationToast(() => purchasesApi.action(id, 'place'), { success: 'Order placed with supplier', invalidate: KEYS });
  const receive = useMutationToast((items) => purchasesApi.action(id, 'receive', { items }), { success: 'Goods received — stock updated', invalidate: KEYS, onSuccess: () => setModal(null) });
  const cancel = useMutationToast((reason) => purchasesApi.action(id, 'cancel', { reason }), { success: 'Purchase order cancelled', invalidate: KEYS, onSuccess: () => setModal(null) });

  return (
    <QueryState query={query}>
      {(po) => {
        const open = ['ORDERED', 'PARTIALLY_RECEIVED'].includes(po.status);
        const outstanding = po.items.map((l) => ({ ...l, outstanding: l.quantity - l.receivedQuantity }));
        return (
          <div className="space-y-6">
            <PageHeader
              back="/app/purchases"
              title={`Purchase order ${po.poNumber}`}
              subtitle={
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={po.status} /> <StatusBadge status={po.paymentStatus} /> · {po.supplier?.name}
                </span>
              }
              actions={
                <>
                  {po.status === 'DRAFT' && can('purchases:write') && <Button icon={Send} loading={place.isPending} onClick={() => place.mutate()}>{t('Place order')}</Button>}
                  {open && can('purchases:write') && (
                    <Button icon={PackageCheck} onClick={() => { setReceipt(Object.fromEntries(outstanding.map((l) => [l._id, l.outstanding]))); setModal('receive'); }}>
                      {t('Receive goods')}
                    </Button>
                  )}
                  {po.status !== 'CANCELLED' && po.amountPaid < po.total && can('payments:write') && <Button variant="secondary" icon={Banknote} onClick={() => setModal('pay')}>{t('Pay')}</Button>}
                  {['DRAFT', 'ORDERED'].includes(po.status) && po.amountPaid === 0 && can('purchases:write') && <Button variant="ghost" icon={XCircle} className="text-red-600" onClick={() => setModal('cancel')}>{t('Cancel')}</Button>}
                </>
              }
            />
            <div className="grid gap-6 xl:grid-cols-3">
              <Card title={t('Items')} padded={false} className="xl:col-span-2">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-stone-100">
                    <thead className="bg-stone-50">
                      <tr>
                        <th className="table-th">{t('Material')}</th>
                        <th className="table-th text-right">{t('Ordered')}</th>
                        <th className="table-th">{t('Received')}</th>
                        <th className="table-th text-right">{t('Unit cost')}</th>
                        <th className="table-th text-right">{t('Total')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {po.items.map((l) => (
                        <tr key={l._id}>
                          <td className="table-td">
                            <Link to={`/app/materials/${l.material?._id}`} className="link">{l.material?.name || l.materialName}</Link>
                          </td>
                          <td className="table-td text-right">
                            {number(l.quantity)} {l.material?.unit}
                          </td>
                          <td className="table-td">
                            <ProgressBar value={(l.receivedQuantity / l.quantity) * 100} className="w-32" />
                            <span className="text-xs text-stone-500">{number(l.receivedQuantity)} received</span>
                          </td>
                          <td className="table-td text-right tabular-nums">{money(l.unitCost)}</td>
                          <td className="table-td text-right tabular-nums">{money(l.quantity * l.unitCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <div className="space-y-6">
                <Card title={t('Summary')}>
                  <DetailList
                    columns={1}
                    items={[
                      { label: 'Supplier', value: <Link className="link" to={`/app/suppliers/${po.supplier?._id}`}>{po.supplier?.name}</Link> },
                      { label: 'Order date', value: date(po.orderDate) },
                      { label: 'Expected', value: date(po.expectedDate) },
                      { label: 'Received', value: date(po.receivedDate) },
                      { label: 'Total', value: money(po.total) },
                      { label: 'Value received', value: money(po.receivedValue) },
                      { label: 'Paid', value: money(po.amountPaid) },
                      { label: 'Created by', value: po.createdBy?.name },
                      po.notes && { label: 'Notes', value: po.notes },
                    ]}
                  />
                </Card>
                {po.payments.length > 0 && (
                  <Card title={t('Payments')}>
                    <ul className="space-y-2 text-sm">
                      {po.payments.map((p) => (
                        <li key={p._id} className="flex justify-between">
                          <span>
                            {dateTime(p.paidAt)} · {t(label(p.method))}
                          </span>
                          <span className="tabular-nums">{money(p.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            </div>

            <Modal
              open={modal === 'receive'}
              onClose={() => setModal(null)}
              title={t('Receive goods')}
              description={t('Stock is increased and the supplier balance grows by the value received.')}
              footer={
                <Button loading={receive.isPending} onClick={() => receive.mutate(Object.entries(receipt).filter(([, q]) => Number(q) > 0).map(([itemId, q]) => ({ itemId, quantity: Number(q) })))}>
                  {t('Confirm receipt')}
                </Button>
              }
            >
              <div className="space-y-3">
                {outstanding
                  .filter((l) => l.outstanding > 0)
                  .map((l) => (
                    <Input
                      key={l._id}
                      label={`${l.material?.name || l.materialName} — outstanding ${number(l.outstanding)} ${l.material?.unit || ''}`}
                      type="number"
                      min="0"
                      max={l.outstanding}
                      step="any"
                      value={receipt[l._id] ?? ''}
                      onChange={(e) => setReceipt((r) => ({ ...r, [l._id]: e.target.value }))}
                    />
                  ))}
              </div>
            </Modal>
            <SupplierPaymentModal open={modal === 'pay'} onClose={() => setModal(null)} supplier={po.supplier} />
            <ConfirmDialog open={modal === 'cancel'} onClose={() => setModal(null)} title={t('Cancel purchase order?')} confirmLabel={t('Cancel order')} requireReason loading={cancel.isPending} onConfirm={(reason) => cancel.mutate(reason)} />
          </div>
        );
      }}
    </QueryState>
  );
}
