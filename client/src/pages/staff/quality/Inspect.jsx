import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, RotateCcw, X, ShieldCheck } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { Card, PageHeader, DetailList } from '../../../components/ui/misc';
import { StatusBadge } from '../../../components/ui/Badge';
import { QueryState } from '../../../components/ui/States';
import { Textarea } from '../../../components/ui/Field';
import ImagePicker from '../../../components/ui/ImagePicker';
import { qualityApi } from '../../../api/endpoints';
import { fileUrl } from '../../../api/client';
import useMutationToast from '../../../hooks/useMutationToast';
import { QC_ITEMS } from '../../../utils/constants';
import { dateTime, label } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

export default function Inspect() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['qc', id], queryFn: () => qualityApi.get(id) });
  const [checks, setChecks] = useState({});
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState([]);

  useEffect(() => {
    if (query.data) setChecks(Object.fromEntries(QC_ITEMS.map(([k]) => [k, { passed: query.data.checklist?.[k]?.passed ?? null, note: query.data.checklist?.[k]?.note || '' }])));
  }, [query.data]);

  const submit = useMutationToast((status) => qualityApi.inspect(id, { status, checklist: checks, notes }, images), {
    success: (qc) => (qc.status === 'PASSED' ? 'Passed — ready for delivery' : 'Sent back for rework'),
    invalidate: ['qc', 'quality', 'job', 'production', 'dashboard'],
    onSuccess: () => navigate('/app/quality'),
  });

  const set = (key, changes) => setChecks((c) => ({ ...c, [key]: { ...c[key], ...changes } }));
  const values = Object.values(checks);
  const allPassed = values.length && values.every((c) => c.passed === true);
  const anyFailed = values.some((c) => c.passed === false);

  return (
    <QueryState query={query}>
      {(qc) => {
        const job = qc.job || {};
        const done = qc.status !== 'PENDING';
        return (
          <div className="mx-auto max-w-4xl space-y-6">
            <PageHeader
              back="/app/quality"
              title={`Inspection: ${job.title}`}
              subtitle={
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={qc.status} /> {job.jobNumber} · {qc.order?.orderNumber} · attempt {qc.attempt}
                </span>
              }
              actions={<Button to={`/app/production/${job._id}`} variant="secondary">{t('Open job')}</Button>}
            />
            <Card title={t('Specification to check against')}>
              <DetailList
                columns={3}
                items={[
                  { label: 'Quantity', value: job.quantity },
                  { label: 'Colour', value: job.specifications?.color || job.customRequest?.preferredColor || '—' },
                  { label: 'Size', value: job.specifications?.size || '—' },
                  { label: 'Dimensions', value: (() => { const d = job.product?.dimensions || job.customRequest?.dimensions; return d ? `${d.width || '?'} × ${d.height || '?'} × ${d.depth || d.length || '?'} ${d.unit || ''}` : '—'; })() },
                  { label: 'Built by', value: job.assignedWorkers?.map((w) => w.name).join(', ') || '—' },
                  { label: 'Customer notes', value: job.customRequest?.designRequirements || job.specifications?.options || '—' },
                ]}
              />
            </Card>

            <Card title={t('Checklist')} subtitle={done ? `Inspected ${dateTime(qc.inspectedAt)} by ${qc.inspector?.name}` : 'Mark every item'} padded={false}>
              <ul className="divide-y divide-stone-100">
                {QC_ITEMS.map(([key, text]) => {
                  const c = checks[key] || {};
                  return (
                    <li key={key} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                      <span className="flex-1 font-medium">{text}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={done}
                          onClick={() => set(key, { passed: true })}
                          className={clsx('flex h-11 min-w-[88px] items-center justify-center gap-1 rounded-lg border-2 px-3 text-sm font-medium', c.passed === true ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-200 text-stone-600 hover:border-emerald-400')}
                          aria-pressed={c.passed === true}
                        >
                          <Check className="h-4 w-4" /> {t('Pass')}
                        </button>
                        <button
                          type="button"
                          disabled={done}
                          onClick={() => set(key, { passed: false })}
                          className={clsx('flex h-11 min-w-[88px] items-center justify-center gap-1 rounded-lg border-2 px-3 text-sm font-medium', c.passed === false ? 'border-red-600 bg-red-600 text-white' : 'border-stone-200 text-stone-600 hover:border-red-400')}
                          aria-pressed={c.passed === false}
                        >
                          <X className="h-4 w-4" /> {t('Fail')}
                        </button>
                      </div>
                      {c.passed === false && (
                        <input className="input sm:w-60" placeholder="What's wrong?" value={c.note || ''} disabled={done} onChange={(e) => set(key, { note: e.target.value })} aria-label={`${text} note`} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>

            {!done ? (
              <Card title={t('Result')}>
                <div className="space-y-4">
                  <Textarea label={t('Inspector notes')} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <div>
                    <p className="label">{t('Evidence photos')}</p>
                    <ImagePicker files={images} onChange={setImages} capture label={t('Add photo')} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Button size="xl" variant="success" icon={ShieldCheck} disabled={!allPassed} loading={submit.isPending && submit.variables === 'PASSED'} onClick={() => submit.mutate('PASSED')}>
                      {t('Pass')}
                    </Button>
                    <Button size="xl" variant="secondary" icon={RotateCcw} disabled={!anyFailed} loading={submit.isPending && submit.variables === 'REWORK_REQUIRED'} onClick={() => submit.mutate('REWORK_REQUIRED')}>
                      {t('Rework required')}
                    </Button>
                    <Button size="xl" variant="danger" icon={X} disabled={!anyFailed} loading={submit.isPending && submit.variables === 'FAILED'} onClick={() => submit.mutate('FAILED')}>
                      {t('Fail')}
                    </Button>
                  </div>
                  {!allPassed && !anyFailed && <p className="text-sm text-stone-500">{t('Mark each check to pass, or fail at least one to send it back.')}</p>}
                </div>
              </Card>
            ) : (
              <Card title={t('Result')}>
                <p className="text-sm">{qc.notes || 'No notes.'}</p>
                {qc.images?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {qc.images.map((src) => (
                      <a key={src} href={fileUrl(src)} target="_blank" rel="noreferrer">
                        <img src={fileUrl(src)} alt="Inspection evidence" className="h-24 w-24 rounded-lg object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-sm">
                  {t('Outcome:')} <StatusBadge status={qc.status} /> {qc.status !== 'PASSED' && <>— the job was returned to {t(label('IN_PRODUCTION')).toLowerCase()}. <Link className="link" to={`/app/production/${job._id}`}>{t('View job')}</Link></>}
                </p>
              </Card>
            )}
          </div>
        );
      }}
    </QueryState>
  );
}
