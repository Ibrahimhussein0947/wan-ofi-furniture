import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { KeyRound, Pencil, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { FilterBar, PageHeader, SearchInput, Avatar } from '../../../components/ui/misc';
import { Checkbox, Input, Select } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { usersApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import useListParams from '../../../hooks/useListParams';
import useMutationToast from '../../../hooks/useMutationToast';
import { WORKER_ROLES } from '../../../utils/constants';
import BranchSelect from '../../../components/BranchSelect';
import { dateTime, label } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

function UserModal({ open, onClose, user, initialRole }) {
  const t = useT();
  const { can } = useAuth();
  const catalog = useQuery({ queryKey: ['permissions'], queryFn: usersApi.permissions, enabled: open });
  const form = useForm({
    values: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      password: '',
      role: user?.role || initialRole || 'WORKER',
      workerRole: user?.workerRole || 'CARPENTER',
      isActive: user?.isActive ?? true,
      wageRate: '',
    },
  });
  const [extra, setExtra] = useState(user?.permissions || []);
  const [branch, setBranch] = useState(user?.branch || '');
  const role = form.watch('role');
  const workerRole = form.watch('workerRole');
  const save = useMutationToast((body) => (user ? usersApi.update(user._id, body) : usersApi.create(body)), { success: user ? 'User updated' : 'User created', invalidate: ['users', 'workers'], onSuccess: onClose });

  const defaults = new Set([...(catalog.data?.rolePermissions?.[role] || []), ...(role === 'WORKER' ? catalog.data?.workerRolePermissions?.[workerRole] || [] : [])]);
  const submit = form.handleSubmit((v) => {
    const body = { name: v.name, phone: v.phone || undefined, role: v.role, workerRole: v.role === 'WORKER' ? v.workerRole : null, permissions: extra, branch: branch || null };
    if (user) {
      save.mutate({ ...body, isActive: v.isActive, ...(v.email !== user.email && { email: v.email }), ...(v.password && { password: v.password }) });
    } else {
      save.mutate({ ...body, email: v.email, password: v.password, ...(v.role === 'WORKER' && v.wageRate && { worker: { wageRate: Number(v.wageRate) } }) });
    }
  });
  const { errors } = form.formState;

  return (
    <Modal open={open} onClose={onClose} title={user ? `Edit ${user.name}` : 'New staff account'} size="lg" footer={<Button loading={save.isPending} onClick={submit}>{t('Save')}</Button>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('Full name')} required error={errors.name && 'Required'} {...form.register('name', { required: true, minLength: 2 })} />
          <Input label={t('Email')} type="email" required disabled={user?.role === 'CUSTOMER'} error={errors.email && t('Valid email required')} {...form.register('email', { required: true, pattern: /^\S+@\S+\.\S+$/ })} />
          <Input label={t('Phone')} {...form.register('phone')} />
          <Input
            label={user ? 'New password (optional)' : 'Temporary password'}
            type="password"
            autoComplete="new-password"
            hint={t('8+ characters with a letter and a number')}
            error={errors.password && '8+ characters with a letter and a number'}
            {...form.register('password', { validate: (v) => (user && !v) || (/[A-Za-z]/.test(v) && /\d/.test(v) && v.length >= 8) })}
          />
          <Select label={t('Role')} disabled={user?.role === 'CUSTOMER'} options={['OWNER', 'ACCOUNTANT', 'WORKER'].map((r) => ({ value: r, label: t(label(r)) }))} {...form.register('role')} />
          {role === 'WORKER' && <Select label={t('Worker position')} options={WORKER_ROLES.map((r) => ({ value: r, label: t(label(r)) }))} {...form.register('workerRole')} />}
          {role === 'WORKER' && !user && <Input label={t('Monthly wage (optional)')} type="number" min="0" {...form.register('wageRate')} />}
          <BranchSelect label={t('Branch')} placeholder={t('No branch')} value={branch} onChange={(e) => setBranch(e.target.value)} />
          {user && <Checkbox label={t('Account active')} {...form.register('isActive')} />}
        </div>
        {can('permissions:manage') && catalog.data && role !== 'OWNER' && (
          <div>
            <p className="label flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> {t('Permissions')}
            </p>
            <p className="mb-2 text-xs text-stone-500">{t('Ticked-and-greyed permissions come with the role. Tick others to grant extra access to this person only.')}</p>
            <div className="grid max-h-60 gap-1.5 overflow-y-auto rounded-lg border border-stone-200 p-3 sm:grid-cols-2">
              {catalog.data.permissions.map((p) => (
                <Checkbox
                  key={p}
                  label={p}
                  className="font-mono text-xs"
                  disabled={defaults.has(p)}
                  checked={defaults.has(p) || extra.includes(p)}
                  onChange={(e) => setExtra((x) => (e.target.checked ? [...x, p] : x.filter((y) => y !== p)))}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Users() {
  const t = useT();
  const [params, set] = useListParams();
  const [search, setSearch] = useSearchParams();
  const [editing, setEditing] = useState(search.get('new') ? { new: true, role: search.get('new') } : null);
  const [deleting, setDeleting] = useState(null);
  const { user: me, can } = useAuth();
  const query = useQuery({ queryKey: ['users', params], queryFn: () => usersApi.list({ ...params, new: undefined }), placeholderData: keepPreviousData });
  const remove = useMutationToast((id) => usersApi.remove(id), { success: 'User removed', invalidate: ['users', 'workers'], onSuccess: () => setDeleting(null) });

  const close = () => {
    setEditing(null);
    if (search.get('new')) {
      search.delete('new');
      setSearch(search, { replace: true });
    }
  };

  return (
    <div>
      <PageHeader title={t('Users & roles')} subtitle={t('Staff accounts, roles and permissions')} actions={can('users:write') && <Button icon={UserPlus} onClick={() => setEditing({ new: true })}>{t('New staff account')}</Button>} />
      <FilterBar>
        <SearchInput value={params.search} onChange={(s) => set({ search: s })} placeholder={t('Name, email, phone…')} className="sm:w-72" />
        <Select value={params.role || ''} onChange={(e) => set({ role: e.target.value })} options={['OWNER', 'ACCOUNTANT', 'WORKER', 'CUSTOMER'].map((r) => ({ value: r, label: t(label(r)) }))} placeholder={t('All roles')} aria-label={t('Role')} containerClassName="sm:w-44" />
      </FilterBar>
      <DataTable
        loading={query.isLoading}
        error={query.error}
        rows={query.data?.items}
        pagination={query.data?.pagination}
        onPageChange={(page) => set({ page })}
        columns={[
          {
            key: 'name',
            header: 'User',
            render: (u) => (
              <span className="flex items-center gap-3">
                <Avatar name={u.name} size="sm" />
                <span>
                  <span className="block font-medium">{u.name}</span>
                  <span className="text-xs text-stone-500">{u.email}</span>
                </span>
              </span>
            ),
          },
          { key: 'role', header: 'Role', render: (u) => <Badge tone={u.role === 'OWNER' ? 'brass' : u.role === 'ACCOUNTANT' ? 'blue' : u.role === 'WORKER' ? 'violet' : 'stone'}>{label(u.workerRole || u.role)}</Badge> },
          { key: 'extra', header: 'Extra permissions', mobile: false, render: (u) => (u.permissions?.length ? <span className="inline-flex items-center gap-1 text-xs"><KeyRound className="h-3.5 w-3.5" /> {u.permissions.length}</span> : '—') },
          { key: 'lastLoginAt', header: 'Last login', mobile: false, render: (u) => dateTime(u.lastLoginAt) },
          { key: 'isActive', header: 'Status', render: (u) => (u.isActive ? <Badge tone="green">{t('Active')}</Badge> : <Badge tone="red">{t('Disabled')}</Badge>) },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (u) =>
              can('users:write') && (
                <span className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {String(u._id) !== String(me._id) && (
                    <Button size="icon" variant="ghost" onClick={() => setDeleting(u)} aria-label={`Remove ${u.name}`}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </span>
              ),
          },
        ]}
      />
      {editing && <UserModal open onClose={close} user={editing.new ? null : editing} initialRole={editing.role} />}
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} title={`Remove ${deleting?.name}?`} message={t('The account is disabled and signed out everywhere. Its history is kept.')} confirmLabel={t('Remove')} loading={remove.isPending} onConfirm={() => remove.mutate(deleting._id)} />
    </div>
  );
}
