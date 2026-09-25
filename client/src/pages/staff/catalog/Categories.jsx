import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { PageHeader } from '../../../components/ui/misc';
import { Checkbox, Input, Textarea } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { categoriesApi } from '../../../api/endpoints';
import useMutationToast from '../../../hooks/useMutationToast';

function CategoryModal({ open, onClose, category }) {
  const form = useForm({ values: { name: category?.name || '', description: category?.description || '', sortOrder: category?.sortOrder ?? 0, isActive: category?.isActive ?? true } });
  const save = useMutationToast((body) => (category ? categoriesApi.update(category._id, body) : categoriesApi.create(body)), { success: 'Category saved', invalidate: ['categories'], onSuccess: onClose });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? 'Edit category' : 'New category'}
      footer={
        <Button loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate({ ...v, sortOrder: Number(v.sortOrder) }))}>
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        <Input label="Name" required {...form.register('name', { required: true })} />
        <Textarea label="Description" rows={2} {...form.register('description')} />
        <Input label="Sort order" type="number" {...form.register('sortOrder')} />
        <Checkbox label="Visible in the shop" {...form.register('isActive')} />
      </div>
    </Modal>
  );
}

export default function Categories() {
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const query = useQuery({ queryKey: ['categories', 'staff'], queryFn: () => categoriesApi.list().then((r) => r.items) });
  const remove = useMutationToast((id) => categoriesApi.remove(id), { success: 'Category removed', invalidate: ['categories'], onSuccess: () => setDeleting(null) });

  return (
    <div>
      <PageHeader title="Categories" actions={<Button icon={Plus} onClick={() => setEditing({})}>New category</Button>} />
      <DataTable
        loading={query.isLoading}
        error={query.error}
        rows={query.data}
        columns={[
          { key: 'name', header: 'Name', render: (c) => <span className="font-medium">{c.name}</span> },
          { key: 'slug', header: 'Slug', mobile: false },
          { key: 'productCount', header: 'Products', align: 'right' },
          { key: 'sortOrder', header: 'Order', align: 'right', mobile: false },
          { key: 'isActive', header: 'Visible', render: (c) => (c.isActive ? <Badge tone="green">Visible</Badge> : <Badge>Hidden</Badge>) },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (c) => (
              <span className="flex justify-end gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </span>
            ),
          },
        ]}
      />
      <CategoryModal open={Boolean(editing)} onClose={() => setEditing(null)} category={editing?._id ? editing : null} />
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} title={`Remove ${deleting?.name}?`} message="Categories that still contain products cannot be removed." confirmLabel="Remove" loading={remove.isPending} onConfirm={() => remove.mutate(deleting._id)} />
    </div>
  );
}
