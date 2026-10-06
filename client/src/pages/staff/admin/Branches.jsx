import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { PageHeader } from '../../../components/ui/misc';
import { Checkbox, Input } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { branchesApi } from '../../../api/endpoints';
import useMutationToast from '../../../hooks/useMutationToast';
import { money } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

function BranchModal({ open, onClose, branch }) {
  const t = useT();
  const form = useForm({ values: { name: branch?.name || '', code: branch?.code || '', address: branch?.address || '', phone: branch?.phone || '', isActive: branch?.isActive ?? true } });
  const save = useMutationToast((body) => (branch ? branchesApi.update(branch._id, body) : branchesApi.create(body)), { success: 'Branch saved', invalidate: ['branches'], onSuccess: onClose });
  const { errors } = form.formState;
  return (
    <Modal open={open} onClose={onClose} title={branch ? 'Edit branch' : 'New branch'} footer={<Button loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate(v))}>{t('Save')}</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('Name')} required containerClassName="sm:col-span-2" error={errors.name && 'Required'} {...form.register('name', { required: true, minLength: 2 })} />
        <Input label={t('Code')} required hint={t('Short code, e.g. DSM')} error={errors.code && '2–12 letters or numbers'} {...form.register('code', { required: true, pattern: /^[A-Za-z0-9-]{2,12}$/ })} />
        <Input label={t('Phone')} {...form.register('phone')} />
        <Input label={t('Address')} containerClassName="sm:col-span-2" {...form.register('address')} />
        <Checkbox label={t('Active')} {...form.register('isActive')} />
      </div>
    </Modal>
  );
}

export default function Branches() {
  const t = useT();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const query = useQuery({ queryKey: ['branches', 'all'], queryFn: () => branchesApi.list({ all: 'true' }) });
  const remove = useMutationToast((id) => branchesApi.remove(id), { success: 'Branch removed', invalidate: ['branches'], onSuccess: () => setDeleting(null) });

  return (
    <div>
      <PageHeader
        title={t('Branches')}
        subtitle={t('Showrooms and workshops. Orders, expenses, staff and stock are tracked per branch; move stock between them from Inventory.')}
        actions={<Button icon={Plus} onClick={() => setEditing({})}>{t('New branch')}</Button>}
      />
      <DataTable
        loading={query.isLoading}
        error={query.error}
        rows={query.data}
        columns={[
          { key: 'name', header: 'Branch', render: (b) => <span className="font-medium">{b.name}</span> },
          { key: 'code', header: 'Code' },
          { key: 'address', header: 'Address', mobile: false },
          { key: 'phone', header: 'Phone', mobile: false },
          { key: 'orders', header: 'Orders', align: 'right' },
          { key: 'sales', header: 'Sales', align: 'right', render: (b) => money(b.sales) },
          { key: 'isActive', header: 'Status', render: (b) => (b.isActive ? <Badge tone="green">{t('Active')}</Badge> : <Badge>{t('Inactive')}</Badge>) },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (b) => (
              <span className="flex justify-end gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing(b)} aria-label={`Edit ${b.name}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleting(b)} aria-label={`Delete ${b.name}`}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </span>
            ),
          },
        ]}
      />
      {editing && <BranchModal open onClose={() => setEditing(null)} branch={editing._id ? editing : null} />}
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} title={`Remove ${deleting?.name}?`} message={t('Branches that already have orders, expenses or staff can only be deactivated.')} confirmLabel={t('Remove')} loading={remove.isPending} onConfirm={() => remove.mutate(deleting._id)} />
    </div>
  );
}
