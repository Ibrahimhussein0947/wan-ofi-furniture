import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import ExportMenu from '../../../components/ExportMenu';
import { FilterBar, PageHeader, SearchInput } from '../../../components/ui/misc';
import { Input, Select } from '../../../components/ui/Field';
import { StatusBadge } from '../../../components/ui/Badge';
import PurchaseOrderModal from './PurchaseOrderModal';
import ReorderSuggestions from './ReorderSuggestions';
import { purchasesApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import useListParams from '../../../hooks/useListParams';
import { date, label, money } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

export default function Purchases() {
  const t = useT();
  const [params, set] = useListParams();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { can } = useAuth();
  const query = useQuery({ queryKey: ['purchases', params], queryFn: () => purchasesApi.list(params), placeholderData: keepPreviousData });
  const columns = [
    { key: 'poNumber', header: 'PO', render: (p) => <span className="font-medium">{p.poNumber}</span> },
    { key: 'supplier', header: 'Supplier', render: (p) => p.supplier?.name, exportValue: (p) => p.supplier?.name },
    { key: 'orderDate', header: 'Date', render: (p) => date(p.orderDate), exportValue: (p) => date(p.orderDate) },
    { key: 'expectedDate', header: 'Expected', mobile: false, render: (p) => date(p.expectedDate), exportValue: (p) => date(p.expectedDate) },
    { key: 'total', header: 'Total', align: 'right', render: (p) => money(p.total) },
    { key: 'amountPaid', header: 'Paid', align: 'right', mobile: false, render: (p) => money(p.amountPaid) },
    { key: 'paymentStatus', header: 'Payment', render: (p) => <StatusBadge status={p.paymentStatus} />, exportValue: (p) => p.paymentStatus },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} />, exportValue: (p) => p.status },
  ];
  return (
    <div>
      <PageHeader
        title={t('Purchase orders')}
        actions={
          <>
            <ExportMenu filename="purchase-orders" title={t('Purchase orders')} columns={columns} rows={query.data?.items} />
            {can('purchases:write') && <Button icon={Plus} onClick={() => setCreating(true)}>{t('New purchase order')}</Button>}
          </>
        }
      />
      <ReorderSuggestions />
      <FilterBar>
        <SearchInput value={params.search} onChange={(search) => set({ search })} placeholder={t('PO number…')} className="sm:w-60" />
        <Select value={params.status || ''} onChange={(e) => set({ status: e.target.value })} options={['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'].map((s) => ({ value: s, label: t(label(s)) }))} placeholder={t('All statuses')} aria-label={t('Status')} containerClassName="sm:w-48" />
        <Input type="date" value={params.from || ''} onChange={(e) => set({ from: e.target.value })} aria-label={t('From')} containerClassName="sm:w-40" />
        <Input type="date" value={params.to || ''} onChange={(e) => set({ to: e.target.value })} aria-label="To" containerClassName="sm:w-40" />
      </FilterBar>
      <DataTable columns={columns} loading={query.isLoading} error={query.error} rows={query.data?.items} pagination={query.data?.pagination} onPageChange={(page) => set({ page })} onRowClick={(p) => navigate(`/app/purchases/${p._id}`)} />
      <PurchaseOrderModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
