import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Input, Select, Textarea } from '../../../components/ui/Field';
import { deliveriesApi, workersApi } from '../../../api/endpoints';
import useMutationToast from '../../../hooks/useMutationToast';
import { label, money, toInputDate } from '../../../utils/format';
import { useAuth } from '../../../context/AuthContext';
import { useT } from '../../../i18n/LanguageContext';

export default function ScheduleDeliveryModal({ open, onClose, order }) {
  const t = useT();
  const { can } = useAuth();
  const staff = useQuery({
    queryKey: ['workers', 'delivery-staff'],
    queryFn: () => workersApi.list({ isActive: 'true', limit: 100 }).then((r) => r.items.filter((w) => w.user).map((w) => ({ _id: w.user._id, name: w.user.name, workerRole: w.position }))),
    enabled: open && can('workers:read'),
  });
  const form = useForm({
    values: {
      scheduledDate: toInputDate(new Date(Date.now() + 86400000)),
      deliveryPerson: '',
      vehicle: '',
      phone: order?.contactPhone || '',
      notes: '',
    },
  });
  const mutation = useMutationToast((body) => deliveriesApi.create(body), { success: 'Delivery scheduled', invalidate: ['order', 'orders', 'deliveries'], onSuccess: onClose });
  const submit = form.handleSubmit((v) => mutation.mutate({ ...v, order: order._id, deliveryPerson: v.deliveryPerson || undefined }));

  const people = (staff.data || []).sort((a, b) => (a.workerRole === 'INSTALLER' ? -1 : b.workerRole === 'INSTALLER' ? 1 : 0));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Schedule delivery — ${order?.orderNumber}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {t('Schedule')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {order?.balance > 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Outstanding balance {money(order.balance)} must be paid before the delivery can be dispatched.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('Delivery date')} type="date" required {...form.register('scheduledDate', { required: true })} />
          <Select label={t('Delivery person')} placeholder={t('Assign later')} options={people.map((u) => ({ value: u._id, label: `${u.name} (${t(label(u.workerRole))})` }))} {...form.register('deliveryPerson')} />
          <Input label={t('Vehicle')} placeholder="e.g. T 123 ABC" {...form.register('vehicle')} />
          <Input label={t('Contact phone')} {...form.register('phone')} />
        </div>
        <p className="text-sm text-stone-600">Address: {[order?.deliveryAddress?.street, order?.deliveryAddress?.city].filter(Boolean).join(', ') || 'Not provided'}</p>
        <Textarea label={t('Notes for the team')} rows={2} {...form.register('notes')} />
      </div>
    </Modal>
  );
}
