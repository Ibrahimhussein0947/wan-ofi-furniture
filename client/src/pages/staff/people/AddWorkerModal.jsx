import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import BranchSelect from '../../../components/BranchSelect';
import { Input, Select } from '../../../components/ui/Field';
import { usersApi, workersApi } from '../../../api/endpoints';
import useMutationToast from '../../../hooks/useMutationToast';
import { WORKER_ROLES } from '../../../utils/constants';
import { label, toInputDate } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

const WAGE_TYPES = ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'PER_JOB'];

/** Creates a worker's sign-in account and worker record in one step. */
export default function AddWorkerModal({ open, onClose }) {
  const t = useT();
  const navigate = useNavigate();
  const form = useForm({
    defaultValues: { name: '', email: '', phone: '', password: '', workerRole: 'CARPENTER', wageType: 'MONTHLY', wageRate: '', hireDate: toInputDate(new Date()), branch: '' },
  });
  const { errors } = form.formState;
  const save = useMutationToast(
    async (v) => {
      const user = await usersApi.create({
        name: v.name,
        email: v.email,
        phone: v.phone || undefined,
        password: v.password,
        role: 'WORKER',
        workerRole: v.workerRole,
        branch: v.branch || undefined,
        worker: { wageType: v.wageType, wageRate: v.wageRate ? Number(v.wageRate) : undefined, hireDate: v.hireDate || undefined },
      });
      // Open the new worker's page.
      const { items } = await workersApi.list({ search: user.name, limit: 20 });
      return items.find((w) => (w.user?._id || w.user) === user._id);
    },
    {
      success: 'Worker added',
      invalidate: ['workers', 'users'],
      onSuccess: (worker) => {
        onClose();
        if (worker) navigate(`/app/workers/${worker._id}`);
      },
    }
  );

  return (
    <Modal open={open} onClose={onClose} title={t('Add worker')} size="lg" footer={<Button loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate(v))}>{t('Add worker')}</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('Full name')} required error={errors.name && t('Required')} {...form.register('name', { required: true, minLength: 2 })} />
        <Input label={t('Phone')} type="tel" {...form.register('phone')} />
        <Input label={t('Email')} type="email" required hint={t('They sign in with this email.')} error={errors.email && t('Valid email required')} {...form.register('email', { required: true, pattern: /^\S+@\S+\.\S+$/ })} />
        <Input
          label={t('Password')}
          type="password"
          autoComplete="new-password"
          required
          hint={t('8+ characters with a letter and a number')}
          error={errors.password && t('8+ characters with a letter and a number')}
          {...form.register('password', { required: true, minLength: 8, validate: (v) => /[A-Za-z]/.test(v) && /\d/.test(v) })}
        />
        <Select label={t('Position')} hint={t('Controls which production stages they can update')} options={WORKER_ROLES.map((r) => ({ value: r, label: t(label(r)) }))} {...form.register('workerRole')} />
        <Input label={t('Hire date')} type="date" {...form.register('hireDate')} />
        <Select label={t('Wage type')} options={WAGE_TYPES.map((w) => ({ value: w, label: t(label(w)) }))} {...form.register('wageType')} />
        <Input label={t('Wage rate')} type="number" min="0" step="any" {...form.register('wageRate')} />
        <BranchSelect label="Branch" placeholder="Default branch" {...form.register('branch')} />
      </div>
    </Modal>
  );
}
