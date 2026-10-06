import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Paperclip, X } from 'lucide-react';
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
import { errorMessage } from '../../../api/client';
import { DOCUMENT_ACCEPT, categoryOptions, checkDocument, fileSize, titleFrom } from './WorkerDocuments';

const WAGE_TYPES = ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'PER_JOB'];

/** Creates a worker's sign-in account and worker record in one step. */
export default function AddWorkerModal({ open, onClose }) {
  const t = useT();
  const navigate = useNavigate();
  const form = useForm({
    defaultValues: { name: '', email: '', phone: '', password: '', workerRole: 'CARPENTER', wageType: 'MONTHLY', wageRate: '', hireDate: toInputDate(new Date()), branch: '' },
  });
  const { errors } = form.formState;
  // Optional files (ID, contract…) uploaded to the new worker's record once it exists.
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);
  const addFiles = (e) => {
    const chosen = [...(e.target.files || [])];
    e.target.value = '';
    const rejected = chosen.filter((f) => checkDocument(f));
    rejected.forEach((f) => toast.error(`${f.name}: ${t(checkDocument(f))}`));
    setFiles((list) => [...list, ...chosen.filter((f) => !checkDocument(f)).map((file) => ({ file, category: 'OTHER', title: titleFrom(file.name) }))]);
  };
  const close = () => {
    setFiles([]);
    onClose();
  };
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
      const worker = items.find((w) => (w.user?._id || w.user) === user._id);
      if (worker) {
        for (const f of files) {
          try {
            await workersApi.uploadDocument(worker._id, { title: f.title || f.file.name, category: f.category }, f.file);
          } catch (err) {
            toast.error(`${f.file.name}: ${errorMessage(err)}`);
          }
        }
      }
      return worker;
    },
    {
      success: 'Worker added',
      invalidate: ['workers', 'users'],
      onSuccess: (worker) => {
        close();
        if (worker) navigate(`/app/workers/${worker._id}`);
      },
    }
  );

  return (
    <Modal open={open} onClose={close} title={t('Add worker')} size="lg" footer={<Button loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate(v))}>{t('Add worker')}</Button>}>
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
        <div className="sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-stone-700">{t('Documents (optional)')}</span>
            <input ref={fileRef} type="file" multiple accept={DOCUMENT_ACCEPT} className="sr-only" onChange={addFiles} aria-label={t('Add documents')} />
            <Button size="sm" variant="secondary" icon={Paperclip} onClick={() => fileRef.current?.click()}>
              {t('Add files')}
            </Button>
          </div>
          <p className="mt-1 text-xs text-stone-500">{t('ID, contract, certificates… PDF, Word or photos, up to 5 MB each.')}</p>
          {files.length > 0 && (
            <ul className="mt-2 divide-y divide-stone-100 rounded-lg border border-stone-200">
              {files.map((f, i) => (
                <li key={`${f.file.name}-${i}`} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-stone-800" title={f.file.name}>
                    {f.file.name} <span className="text-xs text-stone-500">· {fileSize(f.file.size)}</span>
                  </span>
                  <Select
                    aria-label={t('Type')}
                    containerClassName="w-40"
                    options={categoryOptions(t)}
                    value={f.category}
                    onChange={(e) => setFiles((list) => list.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}
                  />
                  <Button size="sm" variant="ghost" icon={X} aria-label={t('Remove {name}', { name: f.file.name })} onClick={() => setFiles((list) => list.filter((_, j) => j !== i))} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
