import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import ExportMenu from '../../../components/ExportMenu';
import { FilterBar, PageHeader, SearchInput } from '../../../components/ui/misc';
import { Checkbox } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import CustomerFormModal from './CustomerFormModal';
import { customersApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import useListParams from '../../../hooks/useListParams';
import { date, label, money } from '../../../utils/format';

export default function CustomerList() {
  const [params, set] = useListParams();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { can } = useAuth();
  const query = useQuery({ queryKey: ['customers', params], queryFn: () => customersApi.list(params), placeholderData: keepPreviousData });

  const columns = [
    { key: 'name', header: 'Customer', render: (c) => <span className="font-medium text-stone-900">{c.name}</span> },
    { key: 'customerCode', header: 'Code', mobile: false },
    { key: 'phone', header: 'Phone' },
    { key: 'source', header: 'Source', mobile: false, render: (c) => <Badge>{label(c.source)}</Badge>, exportValue: (c) => c.source },
    { key: 'orderCount', header: 'Orders', align: 'right' },
    { key: 'totalSpent', header: 'Spent', align: 'right', render: (c) => money(c.totalSpent) },
    { key: 'balance', header: 'Balance', align: 'right', render: (c) => <span className={c.balance > 0 ? 'font-semibold text-brass-800' : 'text-stone-400'}>{money(c.balance)}</span> },
    { key: 'createdAt', header: 'Since', mobile: false, render: (c) => date(c.createdAt), exportValue: (c) => date(c.createdAt) },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        actions={
          <>
            <ExportMenu filename="customers" title="Customers" columns={columns} rows={query.data?.items} />
            {can('customers:write') && (
              <Button icon={UserPlus} onClick={() => setCreating(true)}>
                New customer
              </Button>
            )}
          </>
        }
      />
      <FilterBar>
        <SearchInput value={params.search} onChange={(search) => set({ search })} placeholder="Name, phone, email, code…" className="sm:w-80" />
        <Checkbox label="With outstanding balance" checked={params.withDebt === 'true'} onChange={(e) => set({ withDebt: e.target.checked ? 'true' : '' })} />
      </FilterBar>
      <DataTable
        columns={columns}
        loading={query.isLoading}
        error={query.error}
        rows={query.data?.items}
        pagination={query.data?.pagination}
        onPageChange={(page) => set({ page })}
        onRowClick={(c) => navigate(`/app/customers/${c._id}`)}
      />
      <CustomerFormModal open={creating} onClose={() => setCreating(false)} onSaved={(c) => navigate(`/app/customers/${c._id}`)} />
    </div>
  );
}
