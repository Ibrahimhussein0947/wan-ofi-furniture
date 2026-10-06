import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import DataTable from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/misc';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/States';
import { invoicesApi, paymentsApi } from '../../api/endpoints';
import { date, label, money } from '../../utils/format';
import { useT } from '../../i18n/LanguageContext';

export default function Invoices() {
  const t = useT();
  const navigate = useNavigate();
  const invoices = useQuery({ queryKey: ['invoices', 'mine'], queryFn: () => invoicesApi.list({ limit: 50 }) });
  const payments = useQuery({ queryKey: ['payments', 'mine'], queryFn: () => paymentsApi.list({ limit: 50 }) });

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title={t('Invoices')} />
        <DataTable
          loading={invoices.isLoading}
          error={invoices.error}
          rows={invoices.data?.items}
          onRowClick={(i) => navigate(`/account/invoices/${i._id}`)}
          empty={<EmptyState title={t('No invoices yet')} message="Open an order and choose “Invoice” to generate one." />}
          columns={[
            { key: 'invoiceNumber', header: 'Invoice', render: (i) => <span className="font-medium">{i.invoiceNumber}</span> },
            { key: 'order', header: 'Order', render: (i) => i.order?.orderNumber },
            { key: 'issueDate', header: 'Issued', render: (i) => date(i.issueDate) },
            { key: 'total', header: 'Total', align: 'right', render: (i) => money(i.total) },
            { key: 'balance', header: 'Balance', align: 'right', render: (i) => money(i.balance) },
            { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
          ]}
        />
      </div>
      <div>
        <h2 className="mb-4 text-xl font-semibold">{t('Payments & receipts')}</h2>
        <DataTable
          loading={payments.isLoading}
          error={payments.error}
          rows={payments.data?.items}
          onRowClick={(p) => p.status === 'COMPLETED' && navigate(`/account/receipts/${p._id}`)}
          empty={<EmptyState title={t('No payments yet')} />}
          columns={[
            { key: 'receiptNumber', header: 'Receipt', render: (p) => <span className="font-medium">{p.receiptNumber || p.paymentNumber}</span> },
            { key: 'paidAt', header: 'Date', render: (p) => date(p.paidAt) },
            { key: 'order', header: 'Order', render: (p) => p.order?.orderNumber },
            { key: 'method', header: 'Method', render: (p) => t(label(p.method)) },
            { key: 'amount', header: 'Amount', align: 'right', render: (p) => (p.category === 'REFUND' ? `−${money(p.amount)}` : money(p.amount)) },
            { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
          ]}
        />
      </div>
    </div>
  );
}
