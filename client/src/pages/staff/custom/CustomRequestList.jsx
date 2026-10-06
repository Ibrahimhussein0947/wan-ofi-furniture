import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import DataTable from '../../../components/ui/DataTable';
import { FilterBar, PageHeader, SearchInput } from '../../../components/ui/misc';
import { Select } from '../../../components/ui/Field';
import { StatusBadge } from '../../../components/ui/Badge';
import { customOrdersApi } from '../../../api/endpoints';
import useListParams from '../../../hooks/useListParams';
import { CUSTOM_REQUEST_STATUSES } from '../../../utils/constants';
import { date, label, money } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

export default function CustomRequestList() {
  const t = useT();
  const [params, set] = useListParams();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['custom-orders', params], queryFn: () => customOrdersApi.list(params), placeholderData: keepPreviousData });
  return (
    <div>
      <PageHeader title={t('Custom furniture requests')} subtitle={t('Review, estimate and quote customer designs')} />
      <FilterBar>
        <SearchInput value={params.search} onChange={(search) => set({ search })} placeholder={t('Request number, type, description…')} className="sm:w-80" />
        <Select value={params.status || ''} onChange={(e) => set({ status: e.target.value })} options={CUSTOM_REQUEST_STATUSES.map((s) => ({ value: s, label: t(label(s)) }))} placeholder={t('All statuses')} aria-label={t('Status')} containerClassName="sm:w-48" />
      </FilterBar>
      <DataTable
        loading={query.isLoading}
        error={query.error}
        rows={query.data?.items}
        pagination={query.data?.pagination}
        onPageChange={(page) => set({ page })}
        onRowClick={(r) => navigate(`/app/custom-orders/${r._id}`)}
        columns={[
          { key: 'requestNumber', header: 'Request', render: (r) => <span className="font-medium">{r.requestNumber}</span> },
          { key: 'customer', header: 'Customer', render: (r) => r.customer?.name },
          { key: 'furnitureType', header: 'Furniture', render: (r) => `${r.furnitureType} × ${r.quantity}` },
          { key: 'budget', header: 'Budget', align: 'right', render: (r) => (r.budget ? money(r.budget) : '—') },
          { key: 'quotedPrice', header: 'Quote', align: 'right', render: (r) => (r.quotedPrice ? money(r.quotedPrice) : '—') },
          { key: 'requiredDate', header: 'Needed by', mobile: false, render: (r) => date(r.requiredDate) },
          { key: 'createdAt', header: 'Received', render: (r) => date(r.createdAt) },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </div>
  );
}
