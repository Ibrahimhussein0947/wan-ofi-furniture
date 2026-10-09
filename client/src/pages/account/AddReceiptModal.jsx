import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import ImagePicker from '../../components/ui/ImagePicker';
import { paymentsApi } from '../../api/endpoints';
import useMutationToast from '../../hooks/useMutationToast';
import { money } from '../../utils/format';
import { useT } from '../../i18n/LanguageContext';

/** Upload (or replace) the receipt for a payment the customer already submitted. */
export default function AddReceiptModal({ payment, onClose }) {
  const t = useT();
  const [files, setFiles] = useState([]);
  const upload = useMutationToast((file) => paymentsApi.attachReceipt(payment._id, file), {
    success: 'Receipt uploaded. Our accounts team will check it shortly.',
    invalidate: ['order', 'orders', 'dashboard'],
    onSuccess: () => {
      setFiles([]);
      onClose();
    },
  });
  return (
    <Modal
      open={Boolean(payment)}
      onClose={onClose}
      title={payment?.screenshot ? t('Replace receipt') : t('Add receipt')}
      description={payment && `${money(payment.amount)}${payment.reference ? ` · ${t('Ref')} ${payment.reference}` : ''}`}
    >
      <div className='space-y-4'>
        <ImagePicker files={files} onChange={setFiles} max={1} label={t('Add receipt')} capture />
        <p className='text-xs text-stone-500'>
          {t('Upload a photo or screenshot of the bank or mobile-money receipt showing the amount and reference.')}
        </p>
        <Button block disabled={!files.length} loading={upload.isPending} onClick={() => upload.mutate(files[0])}>
          {t('Upload receipt')}
        </Button>
      </div>
    </Modal>
  );
}
