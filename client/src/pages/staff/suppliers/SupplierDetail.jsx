import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Banknote, PackagePlus, Pencil } from 'lucide-react';
import Button from '../../../components/ui/Button';
import DataTable from '../../../components/ui/DataTable';
import { Card, DetailList, PageHeader, StatCard, Tabs } from '../../../components/ui/misc';
import { StatusBadge } from '../../../components/ui/Badge';
import { QueryState } from '../../../components/ui/States';
import { SupplierModal } from './SupplierList';
import PurchaseOrderModal from './PurchaseOrderModal';
import { SupplierPaymentModal } from '../../../components/finance/PaymentModals';
import { suppliersApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import { date, label, money, number } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

export default function SupplierDetail() {
  const t = useT();
  const { id } = useParams();
  const { can } = useAuth();
  const [tab, setTab] = useState('history');
  const [modal, setModal] = useState(null);
  const query = useQuery({ queryKey: ['supplier', id], queryFn: () => suppliersApi.get(id) });
  return (
    <QueryState query={query}>
      {(s) => (
        <div className="space-y-6">
          <PageHeader
            back="/app/suppliers"
            title={s.name}
            subtitle={s.paymentTerms && `Terms: ${s.paymentTerms}`}
            actions={
              <>
                {can('purchases:write') && <Button variant="secondary" icon={PackagePlus} onClick={() => setModal('po')}>{t('New purchase order')}</Button>}
                {can('payments:write') && <Button icon={Banknote} onClick={() => setModal('pay')}>{t('Record payment')}</Button>}
                {can('suppliers:write') && <Button variant="ghost" icon={Pencil} onClick={() => setModal('edit')}>{t('Edit')}</Button>}
              </>
            }
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label={t('Outstanding balance')} value={money(s.balance)} tone={s.balance > 0 ? 'red' : 'green'} />
            <StatCard label={t('Purchase orders')} value={s.purchases.length} />
            <StatCard label={t('Total paid')} value={money(s.payments.reduce((sum, p) => sum + p.amount, 0))} tone="green" />
          </div>
          <Card title={t('Contact')}>
            <DetailList
              columns={3}
              items={[
                { label: 'Contact person', value: s.contactPerson || '—' },
                { label: 'Phone', value: s.phone || '—' },
                { label: 'Email', value: s.email || '—' },
                { label: 'Address', value: s.address || '—' },
                { label: 'Supplies', value: (s.materialsSupplied || []).join(', ') || '—' },
                { label: 'Notes', value: s.notes || '—' },
              ]}
            />
          </Card>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'history', label: 'Transaction history' },
              { value: 'purchases', label: 'Purchase orders', count: s.purchases.length },
              { value: 'payments', label: 'Payments', count: s.payments.length },
              { value: 'materials', label: 'Materials', count: s.materials.length },
            ]}
          />
          {tab === 'history' && (
            <DataTable
              dense
              rowKey={(r) => `${r.type}${r.reference}`}
              rows={s.history}
              columns={[
                { key: 'date', header: 'Date', render: (r) => date(r.date) },
                { key: 'type', header: 'Type', render: (r) => t(label(r.type)) },
                { key: 'reference', header: 'Reference' },
                { key: 'debit', header: 'Goods received', align: 'right', render: (r) => (r.debit ? money(r.debit) : '') },
                { key: 'credit', header: 'Paid', align: 'right', render: (r) => (r.credit ? money(r.credit) : '') },
              ]}
            />
          )}
          {tab === 'purchases' && (
            <DataTable
              dense
              rows={s.purchases}
              columns={[
                { key: 'poNumber', header: 'PO', render: (p) => <Link to={`/app/purchases/${p._id}`} className="link">{p.poNumber}</Link> },
                { key: 'orderDate', header: 'Date', render: (p) => date(p.orderDate) },
                { key: 'total', header: 'Total', align: 'right', render: (p) => money(p.total) },
                { key: 'receivedValue', header: 'Received', align: 'right', render: (p) => money(p.receivedValue) },
                { key: 'amountPaid', header: 'Paid', align: 'right', render: (p) => money(p.amountPaid) },
                { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
              ]}
            />
          )}
          {tab === 'payments' && (
            <DataTable
              dense
              rows={s.payments}
              columns={[
                { key: 'paymentNumber', header: 'Payment', render: (p) => <Link to={`/app/receipts/${p._id}`} className="link">{p.receiptNumber || p.paymentNumber}</Link> },
                { key: 'paidAt', header: 'Date', render: (p) => date(p.paidAt) },
                { key: 'po', header: 'PO', render: (p) => p.purchaseOrder?.poNumber || '—' },
                { key: 'method', header: 'Method', render: (p) => t(label(p.method)) },
                { key: 'amount', header: 'Amount', align: 'right', render: (p) => money(p.amount) },
              ]}
            />
          )}
          {tab === 'materials' && (
            <DataTable
              dense
              rows={s.materials}
              columns={[
                { key: 'name', header: 'Material', render: (m) => <Link to={`/app/materials/${m._id}`} className="link">{m.name}</Link> },
                { key: 'quantity', header: 'In stock', align: 'right', render: (m) => `${number(m.quantity)} ${m.unit}` },
                { key: 'unitCost', header: 'Unit cost', align: 'right', render: (m) => money(m.unitCost) },
              ]}
            />
          )}
          <SupplierModal open={modal === 'edit'} onClose={() => setModal(null)} supplier={s} />
          <SupplierPaymentModal open={modal === 'pay'} onClose={() => setModal(null)} supplier={s} />
          <PurchaseOrderModal open={modal === 'po'} onClose={() => setModal(null)} supplier={s} />
        </div>
      )}
    </QueryState>
  );
}
