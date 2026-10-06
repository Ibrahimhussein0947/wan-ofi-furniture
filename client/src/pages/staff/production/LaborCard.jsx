import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Clock } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { Card } from '../../../components/ui/misc';
import { Input, Select } from '../../../components/ui/Field';
import { productionApi } from '../../../api/endpoints';
import useMutationToast from '../../../hooks/useMutationToast';
import { date, number, toInputDate } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

/** Hours each worker has logged on a production job; assigned workers and managers can add more. */
export default function LaborCard({ job, user, manager }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const assigned = job.assignedWorkers.some((w) => w._id === user._id);
  const canLog = manager || assigned;
  const log = job.laborLog || [];
  const total = log.reduce((sum, e) => sum + e.hours, 0);
  const byWorker = Object.values(
    log.reduce((acc, e) => {
      const key = e.worker?._id || 'unknown';
      acc[key] = acc[key] || { name: e.worker?.name || 'Former worker', hours: 0 };
      acc[key].hours += e.hours;
      return acc;
    }, {})
  );

  const form = useForm({ defaultValues: { hours: '', date: toInputDate(new Date()), note: '', worker: assigned ? user._id : job.assignedWorkers[0]?._id || '' } });
  const save = useMutationToast((body) => productionApi.action(job._id, 'hours', body), {
    success: 'Hours logged',
    invalidate: ['job', 'production'],
    onSuccess: () => {
      setOpen(false);
      form.reset({ ...form.getValues(), hours: '', note: '' });
    },
  });
  const submit = form.handleSubmit((v) => save.mutate({ hours: Number(v.hours), date: v.date || undefined, note: v.note || undefined, worker: manager ? v.worker : undefined }));

  return (
    <Card
      title={t('Hours worked')}
      subtitle={total ? `${number(total)} h logged in total` : undefined}
      actions={
        canLog && job.assignedWorkers.length > 0 && (
          <Button size="sm" variant="secondary" icon={Clock} onClick={() => setOpen(true)}>
            {t('Log hours')}
          </Button>
        )
      }
    >
      {!log.length ? (
        <p className="text-sm text-stone-500">{t('No hours logged yet.')}</p>
      ) : (
        <>
          <ul className="space-y-1.5 text-sm">
            {byWorker.map((w) => (
              <li key={w.name} className="flex justify-between">
                <span>{w.name}</span>
                <span className="tabular-nums text-stone-600">{number(w.hours)} h</span>
              </li>
            ))}
          </ul>
          <details className="mt-3 text-xs text-stone-500">
            <summary className="cursor-pointer">{t('Show entries')}</summary>
            <ul className="mt-2 space-y-1">
              {[...log].reverse().map((e) => (
                <li key={e._id}>
                  {date(e.date)} · {e.worker?.name} · {number(e.hours)} h{e.note && ` · ${e.note}`}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={t('Log hours')} size="sm" footer={<Button loading={save.isPending} onClick={submit}>{t('Save')}</Button>}>
        <div className="space-y-4">
          {manager && (
            <Select label={t('Worker')} options={job.assignedWorkers.map((w) => ({ value: w._id, label: w.name }))} {...form.register('worker', { required: true })} />
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('Hours')} type="number" step="0.25" min="0.25" max="24" required error={form.formState.errors.hours && 'Between 0.25 and 24'} {...form.register('hours', { required: true, min: 0.25, max: 24 })} />
            <Input label={t('Date')} type="date" max={toInputDate(new Date())} {...form.register('date')} />
          </div>
          <Input label={t('What was done (optional)')} placeholder="e.g. Sanding and first coat" {...form.register('note')} />
        </div>
      </Modal>
    </Card>
  );
}
