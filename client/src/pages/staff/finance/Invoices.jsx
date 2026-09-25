import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import DataTable from '../../../components/ui/DataTable';
import ExportMenu from '../../../components/ExportMenu';
import { Checkbox, Input, Select } from '../../../components/ui/Field';
import { FilterBar, PageHeader, SearchInput } from '../../../components/ui/misc';
import { StatusBadge } from '../../../components/ui/Badge';
import { invoicesApi } from '../../../api/endpoints';
import useListParams from '../../../hooks/useListParams';
import { date, daysUntil, label, money } from '../../../utils/format';

export default function Invoices() {
  const [params, set] = useListParams();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['invoices', params], queryFn: () => invoicesApi.list(params), placeholderData: keepPreviousData });
  const columns = [
    { key: 'invoiceNumber', header: 'Invoice', render: (i) => <span className="font-medium">{i.invoiceNumber}</span> },
    { key: 'customer', header: 'Customer', render: (i) => i.customer?.name, exportValue: (i) => i.customer?.name },
    { key: 'order', header: 'Order', render: (i) => i.order?.orderNumber, exportValue: (i) => i.order?.orderNumber },
    { key: 'issueDate', header: 'Issued', render: (i) => date(i.issueDate), exportValue: (i) => date(i.issueDate) },
    {
      key: 'dueDate',
      header: 'Due',
      render: (i) => {
        const overdue = i.balance > 0 && daysUntil(i.dueDate) < 0 && i.status !== 'VOID';
        return <span className={overdue ? 'font-semibold text-red-600' : ''}>{date(i.dueDate)}</span>;
      },
      exportValue: (i) => date(i.dueDate),
    },
    { key: 'total', header: 'Total', align: 'right', render: (i) => money(i.total) },
    { key: 'amountPaid', header: 'Paid', align: 'right', mobile: false, render: (i) => money(i.amountPaid) },
    { key: 'balance', header: 'Balance', align: 'right', render: (i) => money(i.balance) },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} />, exportValue: (i) => i.status },
  ];
  return (
    <div>
      <PageHeader title="Invoices" subtitle="Generate invoices from the order page" actions={<ExportMenu filename="invoices" title="Invoices" columns={columns} rows={query.data?.items} />} />
      <FilterBar>
        <SearchInput value={params.search} onChange={(search) => set({ search })} placeholder="Invoice number…" className="sm:w-56" />
        <Select value={params.status || ''} onChange={(e) => set({ status: e.target.value })} options={['ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'].map((s) => ({ value: s, label: label(s) }))} placeholder="All statuses" aria-label="Status" containerClassName="sm:w-44" />
        <Input type="date" value={params.from || ''} onChange={(e) => set({ from: e.target.value })} aria-label="From" containerClassName="sm:w-40" />
        <Input type="date" value={params.to || ''} onChange={(e) => set({ to: e.target.value })} aria-label="To" containerClassName="sm:w-40" />
        <Checkbox label="Overdue only" checked={params.overdue === 'true'} onChange={(e) => set({ overdue: e.target.checked ? 'true' : '' })} />
      </FilterBar>
      <DataTable columns={columns} loading={query.isLoading} error={query.error} rows={query.data?.items} pagination={query.data?.pagination} onPageChange={(page) => set({ page })} onRowClick={(i) => navigate(`/app/invoices/${i._id}`)} />
    </div>
  );
}
