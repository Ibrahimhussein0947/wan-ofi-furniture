import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Download, Eye, FileText, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { Card } from '../../../components/ui/misc';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/States';
import { Input, Select, Textarea } from '../../../components/ui/Field';
import { workersApi } from '../../../api/endpoints';
import { errorMessage } from '../../../api/client';
import useMutationToast from '../../../hooks/useMutationToast';
import { date } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

export const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif';
export const MAX_DOCUMENT_MB = 5;

const CATEGORY_LABELS = { ID: 'ID / passport', CONTRACT: 'Contract', CERTIFICATE: 'Certificate', CV: 'CV', MEDICAL: 'Medical', OTHER: 'Other' };
export const categoryOptions = (t) => Object.entries(CATEGORY_LABELS).map(([value, text]) => ({ value, label: t(text) }));

export const fileSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
export const titleFrom = (name) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

/** Checks a chosen file before upload; returns an error message or null. */
export function checkDocument(file) {
  if (!file) return 'Choose a file';
  if (file.size > MAX_DOCUMENT_MB * 1024 * 1024) return `Files must be ${MAX_DOCUMENT_MB} MB or smaller`;
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!DOCUMENT_ACCEPT.split(',').includes(ext)) return 'Only PDF, Word or image files';
  return null;
}

function UploadModal({ open, onClose, workerId }) {
  const t = useT();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const form = useForm({ defaultValues: { title: '', category: 'ID', notes: '' } });
  const close = () => {
    form.reset();
    setFile(null);
    setFileError(null);
    onClose();
  };
  const upload = useMutationToast((v) => workersApi.uploadDocument(workerId, v, file), {
    success: 'Document uploaded',
    invalidate: [['worker-documents', workerId]],
    onSuccess: close,
  });
  const choose = (e) => {
    const f = e.target.files?.[0] || null;
    const problem = f && checkDocument(f);
    setFile(f);
    setFileError(problem ? t(problem) : null);
    if (f && !form.getValues('title')) form.setValue('title', titleFrom(f.name));
  };
  const submit = form.handleSubmit((v) => {
    const problem = checkDocument(file);
    if (problem) return setFileError(t(problem));
    return upload.mutate(v);
  });
  return (
    <Modal open={open} onClose={close} title={t('Upload document')} footer={<Button icon={Upload} loading={upload.isPending} onClick={submit}>{t('Upload')}</Button>}>
      <div className="space-y-4">
        <div>
          <input ref={fileRef} type="file" accept={DOCUMENT_ACCEPT} className="sr-only" onChange={choose} aria-label={t('File')} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-stone-300 px-4 py-6 text-center transition hover:border-brass-400 hover:bg-walnut-50/40"
          >
            <Upload className="h-6 w-6 text-brass-600" />
            <span className="break-all text-sm font-medium text-stone-800">{file ? file.name : t('Choose a file')}</span>
            <span className="text-xs text-stone-500">{file ? fileSize(file.size) : t('PDF, Word or photo · up to {mb} MB', { mb: MAX_DOCUMENT_MB })}</span>
          </button>
          {fileError && <p className="mt-1.5 text-sm text-red-600">{fileError}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('Title')} required error={form.formState.errors.title && t('Required')} placeholder={t('e.g. National ID')} {...form.register('title', { required: true })} />
          <Select label={t('Type')} options={categoryOptions(t)} {...form.register('category')} />
        </div>
        <Textarea label={t('Notes')} rows={2} placeholder={t('e.g. expires March 2028')} {...form.register('notes')} />
      </div>
    </Modal>
  );
}

/** Private files on a worker's record: IDs, contracts, certificates… Visible only to staff who manage workers. */
export default function WorkerDocuments({ workerId }) {
  const t = useT();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(null);
  const query = useQuery({ queryKey: ['worker-documents', workerId], queryFn: () => workersApi.documents(workerId) });
  const remove = useMutationToast((doc) => workersApi.removeDocument(workerId, doc._id), {
    success: 'Document deleted',
    invalidate: [['worker-documents', workerId]],
    onSuccess: () => setDeleting(null),
  });

  // Fetches the file with the staff sign-in, then opens or saves it from a temporary local link.
  const openFile = async (doc, download) => {
    const win = download ? null : window.open('', '_blank');
    setBusy(doc._id);
    try {
      const blob = await workersApi.documentFile(workerId, doc._id);
      const url = URL.createObjectURL(new Blob([blob], { type: doc.mimetype }));
      if (win) {
        win.location.href = url;
      } else {
        Object.assign(document.createElement('a'), { href: url, download: doc.fileName }).click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      win?.close();
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const docs = query.data || [];
  return (
    <Card
      title={t('Documents')}
      subtitle={t('ID, contract, certificates and other files. Private to staff who manage workers.')}
      actions={
        <Button size="sm" icon={Upload} onClick={() => setUploading(true)}>
          {t('Upload document')}
        </Button>
      }
      padded={false}
    >
      {query.isLoading ? (
        <p className="p-5 text-sm text-stone-500">{t('Loading…')}</p>
      ) : query.isError ? (
        <p className="p-5 text-sm text-red-600">{errorMessage(query.error)}</p>
      ) : docs.length === 0 ? (
        <EmptyState icon={FileText} title={t('No documents yet')} message={t('Upload a copy of their ID, signed contract or certificates.')} />
      ) : (
        <ul className="divide-y divide-stone-100">
          {docs.map((d) => {
            const Icon = d.mimetype.startsWith('image/') ? ImageIcon : FileText;
            const canPreview = d.mimetype.startsWith('image/') || d.mimetype === 'application/pdf';
            return (
              <li key={d._id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Icon className="h-5 w-5 shrink-0 text-brass-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-stone-900">{d.title}</span>
                    <Badge>{t(CATEGORY_LABELS[d.category] || d.category)}</Badge>
                  </div>
                  <p className="truncate text-xs text-stone-500">
                    {d.fileName} · {fileSize(d.size)} · {date(d.createdAt)}
                    {d.uploadedBy?.name ? ` · ${d.uploadedBy.name}` : ''}
                  </p>
                  {d.notes && <p className="mt-0.5 text-xs text-stone-600">{d.notes}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {canPreview && (
                    <Button size="sm" variant="ghost" icon={Eye} disabled={busy === d._id} onClick={() => openFile(d, false)}>
                      {t('View')}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" icon={Download} disabled={busy === d._id} onClick={() => openFile(d, true)}>
                    {t('Download')}
                  </Button>
                  <Button size="sm" variant="ghost" icon={Trash2} className="text-red-600" onClick={() => setDeleting(d)} aria-label={t('Delete {name}', { name: d.title })} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <UploadModal open={uploading} onClose={() => setUploading(false)} workerId={workerId} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={t('Delete {name}?', { name: deleting?.title })}
        message={t('The file is removed from this worker’s record. This cannot be undone.')}
        confirmLabel={t('Delete')}
        loading={remove.isPending}
        onConfirm={() => remove.mutate(deleting)}
      />
    </Card>
  );
}
