import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import { Textarea } from './Field';

/**
 * Confirmation for irreversible or important actions.
 * With `requireReason`, the user must type a reason that is passed to onConfirm.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading,
  requireReason = false,
  reasonLabel = 'Reason',
}) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setReason('');
  }, [open]);
  const invalid = requireReason && reason.trim().length < 3;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={() => onConfirm(reason.trim())} loading={loading} disabled={invalid}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {tone === 'danger' && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
        )}
        <div className="flex-1 space-y-3">
          {message && <div className="text-sm text-stone-600">{message}</div>}
          {requireReason && <Textarea label={reasonLabel} value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} />}
        </div>
      </div>
    </Modal>
  );
}
