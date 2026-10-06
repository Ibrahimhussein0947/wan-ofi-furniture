import { useFieldArray, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Input, Select, Textarea } from '../../../components/ui/Field';
import { customersApi } from '../../../api/endpoints';
import useMutationToast from '../../../hooks/useMutationToast';
import { useT } from '../../../i18n/LanguageContext';

// Same shape check the server enforces (the server also verifies IBAN checksums).
const accountNumberError = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null; // untouched rows are dropped before saving
  return /^[\dA-Za-z][\dA-Za-z\s-]{4,59}$/.test(raw) ? null : 'Only letters, digits, spaces and dashes (5–60 characters).';
};
const emptyAccount = { bankName: '', accountName: '', accountNumber: '', branch: '', notes: '' };

export default function CustomerFormModal({ open, onClose, customer, onSaved }) {
  const t = useT();
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
      bankAccounts: customer?.bankAccounts?.length ? customer.bankAccounts.map((a) => ({ ...emptyAccount, ...a })) : [],
    },
  });
  const accounts = useFieldArray({ control: form.control, name: 'bankAccounts' });
  const mutation = useMutationToast((body) => (customer ? customersApi.update(customer._id, body) : customersApi.create(body)), {
    success: customer ? 'Customer updated' : 'Customer created',
    invalidate: ['customers', 'customer'],
    onSuccess: (c) => {
      onSaved?.(c);
      onClose();
    },
  });
  const submit = form.handleSubmit(({ street, city, region, ...v }) => {
    // Drop untouched rows; rows that have anything must be complete and well-formed.
    const bankAccounts = (v.bankAccounts || [])
      .map((a) => ({
        bankName: String(a.bankName || '').trim(),
        accountName: String(a.accountName || '').trim(),
        accountNumber: String(a.accountNumber || '').trim(),
        branch: String(a.branch || '').trim(),
        notes: String(a.notes || '').trim(),
      }))
      .filter((a) => a.bankName || a.accountName || a.accountNumber);
    if (bankAccounts.some((a) => !a.bankName || !a.accountName || !a.accountNumber)) {
      toast.error(t('Each bank account needs a bank name, account name and account number — or remove the row.'));
      return;
    }
    const invalid = bankAccounts.find((a) => accountNumberError(a.accountNumber));
    if (invalid) {
      toast.error(`${invalid.bankName || t('Account number')}: ${t(accountNumberError(invalid.accountNumber))}`);
      return;
    }
    mutation.mutate({ ...v, email: v.email || undefined, phone: v.phone || undefined, address: { street, city, region, country: 'Ethiopia' }, bankAccounts });
  });
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
            {t('Cancel')}
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {t('Save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('Full name')} required error={errors.name && 'Name is required'} {...form.register('name', { required: true, minLength: 2 })} />
        <Input label={t('Phone')} type="tel" {...form.register('phone')} />
        <Input label={t('Email')} type="email" {...form.register('email')} />
        <Input label={t('Company')} {...form.register('company')} />
        <Input label={t('Street / area')} {...form.register('street')} />
        <Input label={t('City')} {...form.register('city')} />
        <Input label={t('Region')} {...form.register('region')} />
        <Select label={t('Source')} options={['WALK_IN', 'ONLINE', 'REFERRAL', 'OTHER'].map((v) => ({ value: v, label: v.replace('_', ' ').toLowerCase() }))} {...form.register('source')} />
        <Textarea label={t('Notes')} containerClassName="sm:col-span-2" {...form.register('notes')} />
      </div>
      <div className="mt-6">
        <p className="mb-1 text-sm font-semibold text-stone-700">{t('Bank accounts')}</p>
        <p className="mb-3 text-xs text-stone-500">{t("The customer's own accounts, used when refunding money to them. Leave rows empty to remove them.")}</p>
        <div className="space-y-3">
          {accounts.fields.map((f, i) => (
            <div key={f.id} className="grid gap-3 rounded-lg border border-stone-200 p-3 sm:grid-cols-2">
              <Input label={t('Bank or wallet')} placeholder={t('e.g. Commercial Bank of Ethiopia')} {...form.register(`bankAccounts.${i}.bankName`)} />
              <Input label={t('Account name')} {...form.register(`bankAccounts.${i}.accountName`)} />
              <Input label={t('Account number')} {...form.register(`bankAccounts.${i}.accountNumber`)} />
              <Input label={t('Branch (optional)')} {...form.register(`bankAccounts.${i}.branch`)} />
              <div className="flex items-end justify-between gap-3 sm:col-span-2">
                <Input containerClassName="flex-1" label={t('Note (optional)')} {...form.register(`bankAccounts.${i}.notes`)} />
                <button type="button" className="mb-1 text-sm font-medium text-red-600 hover:underline" onClick={() => accounts.remove(i)}>
                  {t('Remove')}
                </button>
              </div>
            </div>
          ))}
          {accounts.fields.length < 5 && (
            <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={() => accounts.append({ ...emptyAccount })}>
              {t('Add bank account')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
