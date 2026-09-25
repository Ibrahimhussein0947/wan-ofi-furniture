import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Banknote, Pencil } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import DataTable from '../../../components/ui/DataTable';
import { Card, DetailList, PageHeader, ProgressBar, StatCard } from '../../../components/ui/misc';
import { StatusBadge } from '../../../components/ui/Badge';
import { QueryState } from '../../../components/ui/States';
import { Checkbox, Input, Select, Textarea } from '../../../components/ui/Field';
import { WorkerPaymentModal } from '../../../components/finance/PaymentModals';
import { workersApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import useMutationToast from '../../../hooks/useMutationToast';
import { WORKER_ROLES } from '../../../utils/constants';
import { date, label, money, toInputDate } from '../../../utils/format';

function EditWorker({ open, onClose, worker }) {
  const form = useForm({
    values: {
      position: worker.position,
      phone: worker.phone || '',
      hireDate: toInputDate(worker.hireDate),
      wageType: worker.wageType,
      wageRate: worker.wageRate,
      skills: (worker.skills || []).join(', '),
      isActive: worker.isActive,
      notes: worker.notes || '',
    },
  });
  const save = useMutationToast((body) => workersApi.update(worker._id, body), { success: 'Worker updated', invalidate: ['worker', 'workers'], onSuccess: onClose });
  const submit = form.handleSubmit((v) =>
    save.mutate({
      ...v,
      wageRate: Number(v.wageRate),
      hireDate: v.hireDate || undefined,
      skills: v.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    })
  );
  return (
    <Modal open={open} onClose={onClose} title="Edit worker" footer={<Button loading={save.isPending} onClick={submit}>Save</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Position" hint="Controls which production stages they can update" options={WORKER_ROLES.map((r) => ({ value: r, label: label(r) }))} {...form.register('position')} />
        <Input label="Phone" {...form.register('phone')} />
        <Input label="Hire date" type="date" {...form.register('hireDate')} />
        <Select label="Wage type" options={['DAILY', 'WEEKLY', 'MONTHLY', 'PER_JOB'].map((w) => ({ value: w, label: label(w) }))} {...form.register('wageType')} />
        <Input label="Wage rate" type="number" min="0" {...form.register('wageRate')} />
        <Input label="Skills" hint="Comma separated" {...form.register('skills')} />
        <Textarea label="Notes" containerClassName="sm:col-span-2" rows={2} {...form.register('notes')} />
        <Checkbox label="Active" {...form.register('isActive')} />
      </div>
    </Modal>
  );
}

export default function WorkerDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const [modal, setModal] = useState(null);
  const query = useQuery({ queryKey: ['worker', id], queryFn: () => workersApi.get(id) });
  return (
    <QueryState query={query}>
      {(w) => (
        <div className="space-y-6">
          <PageHeader
            back="/app/workers"
            title={w.user?.name}
            subtitle={`${label(w.position)} · ${w.employeeCode}`}
            actions={
              <>
                {can('payments:write') && <Button icon={Banknote} onClick={() => setModal('pay')}>Pay worker</Button>}
                {can('workers:write') && <Button variant="secondary" icon={Pencil} onClick={() => setModal('edit')}>Edit</Button>}
              </>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active jobs" value={w.performance.active} />
            <StatCard label="Completed jobs" value={w.performance.completed} tone="green" />
            <StatCard label="On-time rate" value={w.performance.onTimeRate === null ? '—' : `${w.performance.onTimeRate}%`} tone="blue" />
            <StatCard label="Reworks" value={w.performance.reworks} tone={w.performance.reworks ? 'red' : 'green'} />
          </div>
          <Card title="Details">
            <DetailList
              columns={3}
              items={[
                { label: 'Email', value: w.user?.email },
                { label: 'Phone', value: w.phone || w.user?.phone || '—' },
                { label: 'Hired', value: date(w.hireDate) },
                { label: 'Wage', value: `${money(w.wageRate)} (${label(w.wageType)})` },
                { label: 'Total paid', value: money(w.totalPaid) },
                { label: 'Skills', value: (w.skills || []).join(', ') || '—' },
                { label: 'Status', value: w.isActive ? 'Active' : 'Inactive' },
                { label: 'Last login', value: date(w.user?.lastLoginAt) },
              ]}
            />
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <h2 className="mb-3 text-lg font-semibold">Jobs</h2>
              <DataTable
                dense
                rows={w.jobs}
                columns={[
                  { key: 'jobNumber', header: 'Job', render: (j) => <Link className="link" to={`/app/production/${j._id}`}>{j.jobNumber}</Link> },
                  { key: 'title', header: 'Furniture' },
                  { key: 'progress', header: 'Progress', render: (j) => <ProgressBar value={j.progress} className="w-24" /> },
                  { key: 'stage', header: 'Stage', render: (j) => <StatusBadge status={j.stage} /> },
                ]}
              />
            </div>
            {can('payments:read') && (
              <div>
                <h2 className="mb-3 text-lg font-semibold">Payments</h2>
                <DataTable
                  dense
                  rows={w.payments}
                  columns={[
                    { key: 'paidAt', header: 'Date', render: (p) => date(p.paidAt) },
                    { key: 'kind', header: 'Type', render: (p) => label(p.kind) },
                    { key: 'notes', header: 'Period' },
                    { key: 'amount', header: 'Amount', align: 'right', render: (p) => money(p.amount) },
                  ]}
                />
              </div>
            )}
          </div>
          {modal === 'edit' && <EditWorker open onClose={() => setModal(null)} worker={w} />}
          <WorkerPaymentModal open={modal === 'pay'} onClose={() => setModal(null)} worker={w} />
        </div>
      )}
    </QueryState>
  );
}
