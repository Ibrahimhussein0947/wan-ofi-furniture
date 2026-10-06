import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Banknote, Pencil, Trash2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import DataTable from '../../../components/ui/DataTable';
import { Card, DetailList, PageHeader, ProgressBar, StatCard } from '../../../components/ui/misc';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState, QueryState } from '../../../components/ui/States';
import { Checkbox, Input, Select, Textarea } from '../../../components/ui/Field';
import { WorkerPaymentModal } from '../../../components/finance/PaymentModals';
import WorkerDocuments from './WorkerDocuments';
import { usersApi, workersApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import useMutationToast from '../../../hooks/useMutationToast';
import { WORKER_ROLES } from '../../../utils/constants';
import { date, label, money, toInputDate } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

function EditWorker({ open, onClose, worker }) {
  const t = useT();
  const { can } = useAuth();
  const canEditAccount = can('users:write') && Boolean(worker.user?._id);
  const form = useForm({
    values: {
      name: worker.user?.name || '',
      email: worker.user?.email || '',
      password: '',
      position: worker.position,
      phone: worker.phone || '',
      hireDate: toInputDate(worker.hireDate),
      wageType: worker.wageType,
      wageRate: worker.wageRate,
      taxRate: worker.taxRate ?? 0,
      skills: (worker.skills || []).join(', '),
      isActive: worker.isActive,
      notes: worker.notes || '',
    },
  });
  // Job details live on the worker record; name, email and password on their sign-in account.
  const save = useMutationToast(
    async ({ name, email, password, ...body }) => {
      const updated = await workersApi.update(worker._id, body);
      if (canEditAccount) {
        const account = {};
        if (name !== worker.user.name) account.name = name;
        if (email !== worker.user.email) account.email = email;
        if (password) account.password = password;
        if (Object.keys(account).length) await usersApi.update(worker.user._id, account);
      }
      return updated;
    },
    { success: 'Worker updated', invalidate: ['worker', 'workers', 'users'], onSuccess: onClose }
  );
  const { errors } = form.formState;
  const submit = form.handleSubmit((v) =>
    save.mutate({
      ...v,
      wageRate: Number(v.wageRate),
      taxRate: Number(v.taxRate),
      hireDate: v.hireDate || undefined,
      skills: v.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    })
  );
  return (
    <Modal open={open} onClose={onClose} title={t('Edit worker')} footer={<Button loading={save.isPending} onClick={submit}>{t('Save')}</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {canEditAccount && (
          <>
            <Input label={t('Full name')} required error={errors.name && t('Required')} {...form.register('name', { required: true, minLength: 2 })} />
            <Input label={t('Email')} type="email" required hint={t('They sign in with this email.')} error={errors.email && t('Valid email required')} {...form.register('email', { required: true, pattern: /^\S+@\S+\.\S+$/ })} />
            <Input
              label={t('New password (optional)')}
              type="password"
              autoComplete="new-password"
              containerClassName="sm:col-span-2"
              hint={t('Leave empty to keep their current password. Setting one signs them out everywhere.')}
              error={errors.password && t('8+ characters with a letter and a number')}
              {...form.register('password', { validate: (v) => !v || (v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v)) })}
            />
          </>
        )}
        <Select label={t('Position')} hint={t('Controls which production stages they can update')} options={WORKER_ROLES.map((r) => ({ value: r, label: t(label(r)) }))} {...form.register('position')} />
        <Input label={t('Phone')} {...form.register('phone')} />
        <Input label={t('Hire date')} type="date" {...form.register('hireDate')} />
        <Select label={t('Wage type')} options={['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'PER_JOB'].map((w) => ({ value: w, label: t(label(w)) }))} {...form.register('wageType')} />
        <Input label={t('Wage rate')} type="number" min="0" {...form.register('wageRate')} />
        <Input label="Tax rate (%)" type="number" min="0" max="100" step="any" hint="Percent of earnings withheld as tax" error={form.formState.errors.taxRate && 'Enter 0–100'} {...form.register('taxRate', { min: 0, max: 100 })} />
        <Input label={t('Skills')} hint={t('Comma separated')} {...form.register('skills')} />
        <Textarea label={t('Notes')} containerClassName="sm:col-span-2" rows={2} {...form.register('notes')} />
        <Checkbox label={t('Active')} {...form.register('isActive')} />
      </div>
    </Modal>
  );
}

export default function WorkerDetail() {
  const t = useT();
  const { id } = useParams();
  const { can } = useAuth();
  const [modal, setModal] = useState(null);
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['worker', id], queryFn: () => workersApi.get(id) });
  const remove = useMutationToast(() => workersApi.remove(id), { success: 'Worker removed', invalidate: ['workers', 'users'], onSuccess: () => navigate('/app/workers') });
  return (
    <QueryState query={query}>
      {(w) => (
        <div className="space-y-6">
          <PageHeader
            back="/app/workers"
            title={w.user?.name}
            subtitle={`${t(label(w.position))} · ${w.employeeCode}`}
            actions={
              <>
                {can('payments:write') && <Button icon={Banknote} onClick={() => setModal('pay')}>{t('Pay worker')}</Button>}
                {can('workers:write') && <Button variant="secondary" icon={Pencil} onClick={() => setModal('edit')}>{t('Edit')}</Button>}
                {can('users:write') && <Button variant="ghost" icon={Trash2} className="text-red-600" onClick={() => setModal('delete')}>{t('Delete')}</Button>}
              </>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t('Active jobs')} value={w.performance.active} />
            <StatCard label={t('Completed jobs')} value={w.performance.completed} tone="green" />
            <StatCard label={t('On-time rate')} value={w.performance.onTimeRate === null ? '—' : `${w.performance.onTimeRate}%`} tone="blue" />
            <StatCard label={t('Reworks')} value={w.performance.reworks} tone={w.performance.reworks ? 'red' : 'green'} />
          </div>
          <Card title={t('Details')}>
            <DetailList
              columns={3}
              items={[
                { label: 'Email', value: w.user?.email },
                { label: 'Phone', value: w.phone || w.user?.phone || '—' },
                { label: 'Hired', value: date(w.hireDate) },
                { label: 'Wage', value: `${money(w.wageRate)} (${t(label(w.wageType))})` },
                { label: 'Tax rate', value: `${w.taxRate || 0}% of earnings` },
                { label: 'Total paid', value: money(w.totalPaid) },
                { label: 'Skills', value: (w.skills || []).join(', ') || '—' },
                { label: 'Status', value: w.isActive ? 'Active' : 'Inactive' },
                { label: 'Last login', value: date(w.user?.lastLoginAt) },
              ]}
            />
          </Card>
          {can('workers:write') && <WorkerDocuments workerId={w._id} />}
          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <h2 className="mb-3 text-lg font-semibold">{t('Jobs')}</h2>
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
                <h2 className="mb-3 text-lg font-semibold">{t('Money given')}</h2>
                <DataTable
                  dense
                  rows={w.payments}
                  onRowClick={(p) => navigate(`/app/receipts/${p._id}`)}
                  empty={<EmptyState title={t('No money recorded yet')} message={t('Use “Pay worker” to register each wage, bonus or advance given.')} />}
                  columns={[
                    { key: 'paidAt', header: 'Date', render: (p) => date(p.paidAt) },
                    { key: 'kind', header: 'Type', render: (p) => t(label(p.kind)) },
                    { key: 'payPeriod', header: 'Pay month', mobile: false, render: (p) => p.payPeriod || '—' },
                    { key: 'method', header: 'Method', mobile: false, render: (p) => t(label(p.method)) },
                    { key: 'receivedBy', header: 'Recorded by', mobile: false, render: (p) => p.receivedBy?.name || '—' },
                    { key: 'notes', header: 'Notes', mobile: false, render: (p) => (p.payPeriod ? p.notes?.replace(/^Period: [^—]*(— )?/, '') : p.notes) || '—' },
                    { key: 'amount', header: 'Amount', align: 'right', render: (p) => money(p.amount) },
                  ]}
                />
              </div>
            )}
          </div>
          {modal === 'edit' && <EditWorker open onClose={() => setModal(null)} worker={w} />}
          <WorkerPaymentModal open={modal === 'pay'} onClose={() => setModal(null)} worker={w} />
          <ConfirmDialog
            open={modal === 'delete'}
            onClose={() => setModal(null)}
            title={t('Delete {name}?', { name: w.user?.name })}
            message={t('Their sign-in is disabled and they leave the team. Payments, hours and job history are kept. Workers on unfinished jobs must be reassigned first.')}
            confirmLabel={t('Delete worker')}
            loading={remove.isPending}
            onConfirm={() => remove.mutate()}
          />
        </div>
      )}
    </QueryState>
  );
}
