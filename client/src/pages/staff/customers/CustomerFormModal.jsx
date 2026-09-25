import { useForm } from 'react-hook-form';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Input, Select, Textarea } from '../../../components/ui/Field';
import { customersApi } from '../../../api/endpoints';
import useMutationToast from '../../../hooks/useMutationToast';

export default function CustomerFormModal({ open, onClose, customer, onSaved }) {
  const form = useForm({
    values: {
      name: customer?.name || '',
      email: customer?.email || '',
      phone: customer?.phone || '',
      company: customer?.company || '',
      street: customer?.address?.street || '',
      city: customer?.address?.city || '',
      region: customer?.address?.region || '',
      source: customer?.source || 'WALK_IN',
      notes: customer?.notes || '',
    },
  });
  const mutation = useMutationToast((body) => (customer ? customersApi.update(customer._id, body) : customersApi.create(body)), {
    success: customer ? 'Customer updated' : 'Customer created',
    invalidate: ['customers', 'customer'],
    onSuccess: (c) => {
      onSaved?.(c);
      onClose();
    },
  });
  const submit = form.handleSubmit(({ street, city, region, ...v }) =>
    mutation.mutate({ ...v, email: v.email || undefined, phone: v.phone || undefined, address: { street, city, region, country: 'Tanzania' } })
  );
  const { errors } = form.formState;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? 'Edit customer' : 'New customer'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" required error={errors.name && 'Name is required'} {...form.register('name', { required: true, minLength: 2 })} />
        <Input label="Phone" type="tel" {...form.register('phone')} />
        <Input label="Email" type="email" {...form.register('email')} />
        <Input label="Company" {...form.register('company')} />
        <Input label="Street / area" {...form.register('street')} />
        <Input label="City" {...form.register('city')} />
        <Input label="Region" {...form.register('region')} />
        <Select label="Source" options={['WALK_IN', 'ONLINE', 'REFERRAL', 'OTHER'].map((v) => ({ value: v, label: v.replace('_', ' ').toLowerCase() }))} {...form.register('source')} />
        <Textarea label="Notes" containerClassName="sm:col-span-2" {...form.register('notes')} />
      </div>
    </Modal>
  );
}
