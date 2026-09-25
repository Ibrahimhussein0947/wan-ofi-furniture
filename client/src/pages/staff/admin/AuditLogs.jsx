import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import DataTable from '../../../components/ui/DataTable';
import ExportMenu from '../../../components/ExportMenu';
import Modal from '../../../components/ui/Modal';
import { FilterBar, PageHeader, SearchInput } from '../../../components/ui/misc';
import { Input, Select } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { auditApi } from '../../../api/endpoints';
import useListParams from '../../../hooks/useListParams';
import { dateTime, label, money } from '../../../utils/format';

const ACTIONS = ['LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'CREATE', 'UPDATE', 'DELETE', 'PAYMENT', 'REFUND', 'STATUS_CHANGE', 'INVENTORY_CHANGE', 'PRODUCTION_CHANGE', 'PERMISSION_CHANGE', 'APPROVAL'];
const TONE = { DELETE: 'red', LOGIN_FAILED: 'red', PAYMENT: 'green', REFUND: 'amber', PERMISSION_CHANGE: 'violet', APPROVAL: 'blue', INVENTORY_CHANGE: 'teal', PRODUCTION_CHANGE: 'violet' };

export default function AuditLogs() {
  const [params, set] = useListParams({ limit: 50 });
  const [detail, setDetail] = useState(null);
  const query = useQuery({ queryKey: ['audit', params], queryFn: () => auditApi.list(params), placeholderData: keepPreviousData });
  const columns = [
    { key: 'createdAt', header: 'Time', render: (l) => dateTime(l.createdAt), exportValue: (l) => dateTime(l.createdAt) },
    { key: 'user', header: 'User', render: (l) => (l.userName ? <span>{l.userName} <span className="text-xs text-stone-500">({label(l.userRole)})</span></span> : 'System'), exportValue: (l) => l.userName },
    { key: 'action', header: 'Action', render: (l) => <Badge tone={TONE[l.action] || 'stone'}>{label(l.action)}</Badge>, exportValue: (l) => l.action },
    { key: 'entity', header: 'Record', render: (l) => `${l.entity || ''} ${l.reference ? `· ${l.reference}` : ''}`, exportValue: (l) => `${l.entity} ${l.reference || ''}` },
    { key: 'description', header: 'Details', render: (l) => <span className="block max-w-sm truncate">{l.description || (l.changes ? 'Field changes' : '')}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: (l) => (l.amount !== null && l.amount !== undefined ? money(l.amount) : ''), exportValue: (l) => l.amount },
    { key: 'ip', header: 'IP', mobile: false },
  ];
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Who did what, and when" actions={<ExportMenu filename="audit-log" title="Audit log" columns={columns} rows={query.data?.items} />} />
      <FilterBar>
        <SearchInput value={params.search} onChange={(search) => set({ search })} placeholder="Reference, user, details…" className="sm:w-72" />
        <Select value={params.action || ''} onChange={(e) => set({ action: e.target.value })} options={ACTIONS.map((a) => ({ value: a, label: label(a) }))} placeholder="All actions" aria-label="Action" containerClassName="sm:w-48" />
        <Select value={params.userRole || ''} onChange={(e) => set({ userRole: e.target.value })} options={['OWNER', 'ACCOUNTANT', 'WORKER', 'CUSTOMER'].map((r) => ({ value: r, label: label(r) }))} placeholder="All roles" aria-label="Role" containerClassName="sm:w-40" />
        <Input type="date" value={params.from || ''} onChange={(e) => set({ from: e.target.value })} aria-label="From" containerClassName="sm:w-40" />
        <Input type="date" value={params.to || ''} onChange={(e) => set({ to: e.target.value })} aria-label="To" containerClassName="sm:w-40" />
      </FilterBar>
      <DataTable dense columns={columns} loading={query.isLoading} error={query.error} rows={query.data?.items} pagination={query.data?.pagination} onPageChange={(page) => set({ page })} onRowClick={setDetail} />
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail && `${label(detail.action)} · ${detail.entity || ''}`} size="lg">
        {detail && (
          <div className="space-y-3 text-sm">
            <p>
              <strong>{detail.userName || 'System'}</strong> ({label(detail.userRole)}) · {dateTime(detail.createdAt)} · {detail.ip}
            </p>
            {detail.reference && <p>Reference: {detail.reference}</p>}
            {detail.description && <p>{detail.description}</p>}
            {detail.amount !== null && detail.amount !== undefined && <p>Amount: {money(detail.amount)}</p>}
            {detail.changes && <pre className="max-h-80 overflow-auto rounded-lg bg-stone-900 p-4 text-xs text-stone-100">{JSON.stringify(detail.changes, null, 2)}</pre>}
            {detail.userAgent && <p className="text-xs text-stone-400">{detail.userAgent}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
