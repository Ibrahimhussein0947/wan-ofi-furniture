import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import ExportMenu from '../../../components/ExportMenu';
import { FilterBar, PageHeader, SearchInput, Avatar } from '../../../components/ui/misc';
import { Select } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { workersApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import useListParams from '../../../hooks/useListParams';
import { WORKER_ROLES } from '../../../utils/constants';
import { label, money } from '../../../utils/format';

export default function Workers() {
  const [params, set] = useListParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const query = useQuery({ queryKey: ['workers', params], queryFn: () => workersApi.list(params), placeholderData: keepPreviousData });
  const columns = [
    {
      key: 'name',
      header: 'Worker',
      render: (w) => (
        <span className="flex items-center gap-3">
          <Avatar name={w.user?.name} size="sm" />
          <span>
            <span className="block font-medium">{w.user?.name}</span>
            <span className="text-xs text-stone-500">{w.employeeCode}</span>
          </span>
        </span>
      ),
      exportValue: (w) => w.user?.name,
    },
    { key: 'position', header: 'Position', render: (w) => <Badge tone="brass">{label(w.position)}</Badge>, exportValue: (w) => w.position },
    { key: 'phone', header: 'Phone', mobile: false },
    { key: 'activeJobs', header: 'Active jobs', align: 'right' },
    { key: 'wage', header: 'Wage', align: 'right', mobile: false, render: (w) => `${money(w.wageRate)} / ${label(w.wageType).toLowerCase()}`, exportValue: (w) => w.wageRate },
    { key: 'isActive', header: 'Status', render: (w) => (w.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>), exportValue: (w) => (w.isActive ? 'Active' : 'Inactive') },
  ];
  return (
    <div>
      <PageHeader
        title="Workers"
        subtitle="Production staff, positions and workload"
        actions={
          <>
            <ExportMenu filename="workers" title="Workers" columns={columns} rows={query.data?.items} />
            {can('users:write') && <Button to="/app/users?new=WORKER" icon={UserPlus}>Add worker</Button>}
          </>
        }
      />
      <FilterBar>
        <SearchInput value={params.search} onChange={(search) => set({ search })} placeholder="Name or employee code…" className="sm:w-72" />
        <Select value={params.position || ''} onChange={(e) => set({ position: e.target.value })} options={WORKER_ROLES.map((r) => ({ value: r, label: label(r) }))} placeholder="All positions" aria-label="Position" containerClassName="sm:w-48" />
      </FilterBar>
      <DataTable columns={columns} loading={query.isLoading} error={query.error} rows={query.data?.items} pagination={query.data?.pagination} onPageChange={(page) => set({ page })} onRowClick={(w) => navigate(`/app/workers/${w._id}`)} />
    </div>
  );
}
