import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import clsx from 'clsx';
import { AlertTriangle, ArrowRight, Camera, CheckCircle2, PackageMinus, PackagePlus, Plus, StickyNote, UserPlus, Undo2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { Card, DetailList, PageHeader, ProgressBar, Avatar } from '../../../components/ui/misc';
import { StatusBadge, Badge } from '../../../components/ui/Badge';
import { QueryState } from '../../../components/ui/States';
import { Input, Select, Textarea, Checkbox } from '../../../components/ui/Field';
import ImagePicker from '../../../components/ui/ImagePicker';
import { materialsApi, productionApi, tasksApi, workersApi } from '../../../api/endpoints';
import { fileUrl } from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import useMutationToast from '../../../hooks/useMutationToast';
import { STAGE_TRANSITIONS, WORKER_STAGE_PERMISSIONS } from '../../../utils/constants';
import { date, dateTime, label, number, timeAgo, toInputDate } from '../../../utils/format';

const KEYS = ['job', 'production', 'dashboard'];

export default function JobDetail() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const [modal, setModal] = useState(null);
  const [photos, setPhotos] = useState([]);
  const query = useQuery({ queryKey: ['job', id], queryFn: () => productionApi.get(id) });
  const manager = can('production:manage');

  const stage = useMutationToast((body) => productionApi.action(id, 'stage', body), { success: (j) => `Moved to ${label(j.stage).toLowerCase()}`, invalidate: KEYS });
  const issue = useMutationToast((body) => productionApi.action(id, 'issue-materials', body), { success: 'Materials issued from stock', invalidate: [...KEYS, 'materials'] });
  const note = useMutationToast((text) => productionApi.action(id, 'notes', { text }), { success: 'Note added', invalidate: KEYS, onSuccess: () => setModal(null) });
  const problem = useMutationToast((body) => productionApi.action(id, 'problems', body), { success: 'Problem reported to your supervisor', invalidate: KEYS, onSuccess: () => setModal(null) });
  const request = useMutationToast((body) => productionApi.action(id, 'material-requests', body), { success: 'Material request sent', invalidate: KEYS, onSuccess: () => setModal(null) });
  const returnMat = useMutationToast((body) => productionApi.action(id, 'return-materials', body), { success: 'Returned to stock', invalidate: [...KEYS, 'materials'], onSuccess: () => setModal(null) });
  const handleReq = useMutationToast(({ requestId, approve }) => productionApi.handleRequest(id, requestId, approve), { success: 'Request handled', invalidate: [...KEYS, 'materials'] });
  const [resolving, setResolving] = useState(null);
  const resolve = useMutationToast(({ problemId, resolution }) => productionApi.resolveProblem(id, problemId, resolution), { success: 'Problem resolved', invalidate: KEYS, onSuccess: () => setResolving(null) });
  const upload = useMutationToast(() => productionApi.uploadImages(id, photos), {
    success: 'Photos uploaded',
    invalidate: KEYS,
    onSuccess: () => {
      setPhotos([]);
      setModal(null);
    },
  });
  const taskUpdate = useMutationToast(({ taskId, status }) => tasksApi.update(taskId, { status }), { success: 'Task updated', invalidate: KEYS });

  const materials = useQuery({ queryKey: ['materials', 'all'], queryFn: () => materialsApi.list({ limit: 100 }).then((r) => r.items), enabled: ['request', 'issue'].includes(modal) });
  const workers = useQuery({ queryKey: ['workers', 'assign'], queryFn: () => workersApi.list({ isActive: 'true', limit: 100 }).then((r) => r.items), enabled: ['assign', 'task'].includes(modal) });

  const noteForm = useForm();
  const problemForm = useForm({ defaultValues: { severity: 'MEDIUM' } });
  const requestForm = useForm();
  const returnForm = useForm();
  const [assignIds, setAssignIds] = useState([]);
  const assign = useMutationToast((body) => productionApi.action(id, 'assign', body), { success: 'Assignment saved', invalidate: KEYS, onSuccess: () => setModal(null) });
  const taskForm = useForm();
  const createTask = useMutationToast((body) => tasksApi.create(body), { success: 'Task created', invalidate: KEYS, onSuccess: () => setModal(null) });

  return (
    <QueryState query={query}>
      {(job) => {
        const allowed = manager ? STAGE_TRANSITIONS[job.stage] : (STAGE_TRANSITIONS[job.stage] || []).filter((s) => (WORKER_STAGE_PERMISSIONS[user.workerRole] || []).includes(s));
        const nextStages = allowed.filter((s) => s !== 'CANCELLED' || manager);
        const materialsOutstanding = job.requiredMaterials.some((m) => m.quantityIssued < m.quantityRequired);
        const openProblems = job.problems.filter((p) => !p.resolved);
        const spec = job.specifications || {};
        const dims = job.product?.dimensions || job.customRequest?.dimensions;

        return (
          <div className="space-y-6">
            <PageHeader
              back={manager ? '/app/production' : '/app'}
              title={job.title}
              subtitle={
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={job.stage} />
                  {job.priority !== 'NORMAL' && <StatusBadge status={job.priority} />}
                  {job.jobNumber} · order {job.order?.orderNumber} · due {date(job.expectedCompletionDate)}
                </span>
              }
            />

            <Card>
              <ProgressBar value={job.progress} showLabel tone={job.progress >= 100 ? 'green' : 'walnut'} />
              {nextStages.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-sm font-medium text-stone-700">Update stage</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {nextStages.map((s) => {
                      const blocked = s === 'IN_PRODUCTION' && materialsOutstanding;
                      return (
                        <Button
                          key={s}
                          size="xl"
                          variant={s === 'CANCELLED' ? 'danger' : 'primary'}
                          iconRight={s === 'CANCELLED' ? undefined : ArrowRight}
                          disabled={blocked}
                          loading={stage.isPending && stage.variables?.stage === s}
                          onClick={() => stage.mutate({ stage: s })}
                          title={blocked ? 'Materials must be issued first' : undefined}
                        >
                          {s === 'QUALITY_CHECK' ? 'Send to quality check' : label(s)}
                        </Button>
                      );
                    })}
                  </div>
                  {materialsOutstanding && nextStages.includes('IN_PRODUCTION') && <p className="mt-2 text-sm text-amber-700">Production can start once all materials are issued.</p>}
                </div>
              )}
              {job.stage === 'QUALITY_CHECK' && <p className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-800">Waiting for quality inspection.{can('quality:manage') && job.qualityChecks?.[0]?.status === 'PENDING' && <Link to={`/app/quality/${job.qualityChecks[0]._id}`} className="ml-2 font-semibold underline">Inspect now</Link>}</p>}

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Button size="lg" variant="secondary" icon={Camera} onClick={() => setModal('photos')}>
                  Photos
                </Button>
                <Button size="lg" variant="secondary" icon={StickyNote} onClick={() => setModal('note')}>
                  Add note
                </Button>
                <Button size="lg" variant="secondary" icon={PackagePlus} onClick={() => setModal('request')}>
                  Request material
                </Button>
                <Button size="lg" variant="secondary" icon={AlertTriangle} className="text-red-700" onClick={() => setModal('problem')}>
                  Report problem
                </Button>
              </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="space-y-6 xl:col-span-2">
                <Card title="Requirements & specifications">
                  <DetailList
                    columns={3}
                    items={[
                      { label: 'Quantity', value: job.quantity },
                      { label: 'Colour', value: spec.color || job.customRequest?.preferredColor || '—' },
                      { label: 'Size', value: spec.size || '—' },
                      { label: 'Product', value: job.product?.name || 'Custom design' },
                      { label: 'Material', value: job.customRequest?.preferredMaterial || '—' },
                      { label: 'Fabric', value: job.customRequest?.fabric || '—' },
                      { label: 'Measurements', value: dims ? `${['width', 'height', 'length', 'depth'].filter((k) => dims[k]).map((k) => `${label(k)[0]} ${dims[k]}`).join(' × ')} ${dims.unit || ''}` : '—' },
                      { label: 'Customer', value: job.customer?.name },
                      { label: 'Options', value: spec.options || '—' },
                    ]}
                  />
                  {(job.instructions || job.customRequest?.description) && (
                    <div className="mt-4 space-y-2 rounded-lg bg-stone-50 p-4 text-sm">
                      {job.instructions && <p><strong>Instructions:</strong> {job.instructions}</p>}
                      {job.customRequest?.description && <p><strong>Customer description:</strong> {job.customRequest.description}</p>}
                      {job.customRequest?.designRequirements && <p><strong>Design:</strong> {job.customRequest.designRequirements}</p>}
                    </div>
                  )}
                  {job.customRequest?.referenceImages?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {job.customRequest.referenceImages.map((src) => (
                        <a key={src} href={fileUrl(src)} target="_blank" rel="noreferrer">
                          <img src={fileUrl(src)} alt="Customer reference" className="h-20 w-20 rounded-lg object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </Card>

                <Card
                  title="Required materials"
                  padded={false}
                  actions={
                    <>
                      {can('materials:issue') && materialsOutstanding && (
                        <Button size="sm" icon={PackageMinus} loading={issue.isPending} onClick={() => issue.mutate({})}>
                          Issue all outstanding
                        </Button>
                      )}
                      {job.requiredMaterials.some((m) => m.quantityIssued - m.quantityReturned > 0) && (
                        <Button size="sm" variant="secondary" icon={Undo2} onClick={() => setModal('return')}>
                          Return leftovers
                        </Button>
                      )}
                    </>
                  }
                >
                  {!job.requiredMaterials.length ? (
                    <p className="p-5 text-sm text-stone-500">No bill of materials for this job. {manager && 'Issue materials individually as needed.'}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-stone-100">
                        <thead className="bg-stone-50">
                          <tr>
                            <th className="table-th">Material</th>
                            <th className="table-th text-right">Required</th>
                            <th className="table-th text-right">Issued</th>
                            <th className="table-th text-right">Returned</th>
                            <th className="table-th text-right">In stock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {job.requiredMaterials.map((m) => {
                            const done = m.quantityIssued >= m.quantityRequired;
                            return (
                              <tr key={m.material?._id || m.name}>
                                <td className="table-td">
                                  <span className="flex items-center gap-2">
                                    {done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="h-4 w-4 rounded-full border-2 border-stone-300" />}
                                    {m.material?.name || m.name}
                                  </span>
                                </td>
                                <td className="table-td text-right tabular-nums">
                                  {number(m.quantityRequired)} {m.material?.unit || m.unit}
                                </td>
                                <td className={clsx('table-td text-right tabular-nums', !done && 'text-amber-700')}>{number(m.quantityIssued)}</td>
                                <td className="table-td text-right tabular-nums">{number(m.quantityReturned)}</td>
                                <td className="table-td text-right tabular-nums text-stone-500">{number(m.material?.quantity)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                {job.materialRequests.length > 0 && (
                  <Card title="Material requests" padded={false}>
                    <ul className="divide-y divide-stone-100">
                      {job.materialRequests.map((r) => (
                        <li key={r._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                          <span>
                            <span className="font-medium">
                              {r.quantity} {r.material?.unit} {r.material?.name}
                            </span>
                            <span className="block text-xs text-stone-500">
                              {r.requestedBy?.name} · {timeAgo(r.requestedAt)} {r.reason && `· ${r.reason}`}
                            </span>
                          </span>
                          {r.status === 'PENDING' && can('materials:issue') ? (
                            <span className="flex gap-2">
                              <Button size="sm" variant="success" onClick={() => handleReq.mutate({ requestId: r._id, approve: true })}>
                                Issue
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => handleReq.mutate({ requestId: r._id, approve: false })}>
                                Reject
                              </Button>
                            </span>
                          ) : (
                            <StatusBadge status={r.status} />
                          )}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {job.images.length > 0 && (
                  <Card title="Production photos">
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                      {job.images.map((img) => (
                        <a key={img._id} href={fileUrl(img.url)} target="_blank" rel="noreferrer" className="group relative">
                          <img src={fileUrl(img.url)} alt={img.caption || `Stage ${label(img.stage)}`} className="aspect-square w-full rounded-lg object-cover" />
                          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] text-white">{label(img.stage)}</span>
                        </a>
                      ))}
                    </div>
                  </Card>
                )}

                <Card title="Notes">
                  {!job.notes.length && <p className="text-sm text-stone-500">No notes yet.</p>}
                  <ul className="space-y-3">
                    {[...job.notes].reverse().map((n) => (
                      <li key={n._id} className="flex gap-3">
                        <Avatar name={n.by?.name} size="sm" />
                        <div>
                          <p className="text-sm">{n.text}</p>
                          <p className="text-xs text-stone-500">
                            {n.by?.name} · {timeAgo(n.at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              <div className="space-y-6">
                <Card title="Team" actions={manager && <Button size="sm" variant="secondary" icon={UserPlus} onClick={() => { setAssignIds(job.assignedWorkers.map((w) => w._id)); setModal('assign'); }}>Assign</Button>}>
                  {!job.assignedWorkers.length && <p className="text-sm text-stone-500">No workers assigned yet.</p>}
                  <ul className="space-y-2">
                    {job.assignedWorkers.map((w) => (
                      <li key={w._id} className="flex items-center gap-2 text-sm">
                        <Avatar name={w.name} size="sm" /> {w.name} <span className="text-xs text-stone-500">{label(w.workerRole)}</span>
                      </li>
                    ))}
                  </ul>
                  {job.supervisor && <p className="mt-3 text-xs text-stone-500">Supervisor: {job.supervisor.name}</p>}
                </Card>

                {openProblems.length > 0 && (
                  <Card title={`Open problems (${openProblems.length})`} className="border-red-200">
                    <ul className="space-y-3">
                      {openProblems.map((p) => (
                        <li key={p._id} className="text-sm">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={p.severity} />
                            <span className="text-xs text-stone-500">
                              {p.reportedBy?.name} · {timeAgo(p.reportedAt)}
                            </span>
                          </div>
                          <p className="mt-1">{p.description}</p>
                          {manager && (
                            <Button size="xs" variant="secondary" className="mt-2" onClick={() => setResolving(p)}>
                              Mark resolved
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                <Card title="Tasks" actions={manager && <Button size="sm" variant="secondary" icon={Plus} onClick={() => setModal('task')}>Add</Button>}>
                  {!job.tasks?.length && <p className="text-sm text-stone-500">No tasks.</p>}
                  <ul className="space-y-2">
                    {job.tasks?.map((t) => (
                      <li key={t._id} className="flex items-center justify-between gap-2 text-sm">
                        <span>
                          <span className={t.status === 'DONE' ? 'text-stone-400 line-through' : ''}>{t.title}</span>
                          <span className="block text-xs text-stone-500">
                            {t.assignedTo?.name || 'Unassigned'} {t.dueDate && `· ${date(t.dueDate)}`}
                          </span>
                        </span>
                        {t.status !== 'DONE' && (manager || String(t.assignedTo?._id) === String(user._id)) ? (
                          <Button size="xs" variant="secondary" onClick={() => taskUpdate.mutate({ taskId: t._id, status: t.status === 'TODO' ? 'IN_PROGRESS' : 'DONE' })}>
                            {t.status === 'TODO' ? 'Start' : 'Done'}
                          </Button>
                        ) : (
                          <StatusBadge status={t.status} />
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>

                {job.qualityChecks?.length > 0 && (
                  <Card title="Quality checks">
                    <ul className="space-y-2 text-sm">
                      {job.qualityChecks.map((q) => (
                        <li key={q._id} className="flex items-center justify-between">
                          <span>
                            Attempt {q.attempt} {q.inspector && `· ${q.inspector.name}`}
                            {q.notes && <span className="block text-xs text-stone-500">{q.notes}</span>}
                          </span>
                          <StatusBadge status={q.status} />
                        </li>
                      ))}
                    </ul>
                    {job.reworkCount > 0 && <Badge tone="red" className="mt-3">Reworked {job.reworkCount}×</Badge>}
                  </Card>
                )}

                <Card title="Stage history">
                  <ol className="space-y-2 text-xs">
                    {[...job.stageHistory].reverse().map((h, i) => (
                      <li key={i}>
                        <span className="font-medium text-stone-800">{label(h.to)}</span> · {dateTime(h.at)} {h.by?.name && `· ${h.by.name}`}
                        {h.note && <span className="block text-stone-500">{h.note}</span>}
                      </li>
                    ))}
                  </ol>
                </Card>
              </div>
            </div>

            {/* Modals */}
            <ConfirmDialog
              open={Boolean(resolving)}
              onClose={() => setResolving(null)}
              tone="primary"
              title="Resolve problem"
              message={resolving?.description}
              confirmLabel="Mark resolved"
              requireReason
              reasonLabel="How was it resolved?"
              loading={resolve.isPending}
              onConfirm={(resolution) => resolve.mutate({ problemId: resolving._id, resolution })}
            />
            <Modal open={modal === 'photos'} onClose={() => setModal(null)} title="Upload production photos" footer={<Button icon={Camera} loading={upload.isPending} disabled={!photos.length} onClick={() => upload.mutate()}>Upload {photos.length || ''}</Button>}>
              <ImagePicker files={photos} onChange={setPhotos} capture large label="Take or choose photos" />
            </Modal>
            <Modal open={modal === 'note'} onClose={() => setModal(null)} title="Add production note" footer={<Button loading={note.isPending} onClick={noteForm.handleSubmit((v) => note.mutate(v.text))}>Save note</Button>}>
              <Textarea label="Note" rows={4} {...noteForm.register('text', { required: true })} />
            </Modal>
            <Modal open={modal === 'problem'} onClose={() => setModal(null)} title="Report a problem" footer={<Button variant="danger" loading={problem.isPending} onClick={problemForm.handleSubmit((v) => problem.mutate(v))}>Report</Button>}>
              <div className="space-y-4">
                <Select label="Severity" options={['LOW', 'MEDIUM', 'HIGH'].map((s) => ({ value: s, label: label(s) }))} {...problemForm.register('severity')} />
                <Textarea label="What's wrong?" rows={4} {...problemForm.register('description', { required: true, minLength: 3 })} error={problemForm.formState.errors.description && 'Describe the problem'} />
              </div>
            </Modal>
            <Modal open={modal === 'request'} onClose={() => setModal(null)} title="Request additional material" footer={<Button loading={request.isPending} onClick={requestForm.handleSubmit((v) => request.mutate({ ...v, quantity: Number(v.quantity) }))}>Send request</Button>}>
              <div className="space-y-4">
                <Select label="Material" placeholder="Choose material" options={(materials.data || []).map((m) => ({ value: m._id, label: `${m.name} (${m.quantity} ${m.unit} in stock)` }))} {...requestForm.register('material', { required: true })} />
                <Input label="Quantity" type="number" step="any" min="0" {...requestForm.register('quantity', { required: true, min: 0.0001 })} />
                <Textarea label="Reason" rows={2} {...requestForm.register('reason')} />
              </div>
            </Modal>
            <Modal open={modal === 'return'} onClose={() => setModal(null)} title="Return unused material" footer={<Button loading={returnMat.isPending} onClick={returnForm.handleSubmit((v) => returnMat.mutate({ items: [{ material: v.material, quantity: Number(v.quantity) }] }))}>Return to stock</Button>}>
              <div className="space-y-4">
                <Select
                  label="Material"
                  placeholder="Choose material"
                  options={job.requiredMaterials.filter((m) => m.quantityIssued - m.quantityReturned > 0).map((m) => ({ value: m.material._id, label: `${m.material.name} (up to ${number(m.quantityIssued - m.quantityReturned)} ${m.material.unit})` }))}
                  {...returnForm.register('material', { required: true })}
                />
                <Input label="Quantity returned" type="number" step="any" min="0" {...returnForm.register('quantity', { required: true })} />
              </div>
            </Modal>
            <Modal open={modal === 'assign'} onClose={() => setModal(null)} title="Assign workers" footer={<Button loading={assign.isPending} onClick={() => assign.mutate({ workerIds: assignIds })}>Save assignment</Button>}>
              <div className="grid gap-2 sm:grid-cols-2">
                {(workers.data || [])
                  .filter((w) => w.user)
                  .map((w) => (
                    <Checkbox
                      key={w._id}
                      label={`${w.user.name} — ${label(w.position)} (${w.activeJobs} active)`}
                      checked={assignIds.includes(w.user._id)}
                      onChange={(e) => setAssignIds((ids) => (e.target.checked ? [...ids, w.user._id] : ids.filter((x) => x !== w.user._id)))}
                    />
                  ))}
              </div>
            </Modal>
            <Modal
              open={modal === 'task'}
              onClose={() => setModal(null)}
              title="New task"
              footer={<Button loading={createTask.isPending} onClick={taskForm.handleSubmit((v) => createTask.mutate({ ...v, job: id, assignedTo: v.assignedTo || undefined, dueDate: v.dueDate || undefined }))}>Create task</Button>}
            >
              <div className="space-y-4">
                <Input label="Title" {...taskForm.register('title', { required: true })} />
                <Select label="Assign to" placeholder="Unassigned" options={job.assignedWorkers.map((w) => ({ value: w._id, label: w.name }))} {...taskForm.register('assignedTo')} />
                <Input label="Due date" type="date" defaultValue={toInputDate(job.expectedCompletionDate)} {...taskForm.register('dueDate')} />
                <Textarea label="Description" rows={2} {...taskForm.register('description')} />
              </div>
            </Modal>
          </div>
        );
      }}
    </QueryState>
  );
}
