import { useForm } from 'react-hook-form';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Input, Select } from '../../../components/ui/Field';
import { inventoryApi } from '../../../api/endpoints';
import useMutationToast from '../../../hooks/useMutationToast';
import { number } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

const atBranch = (item, branchId) => item?.branchStock?.find((b) => b.branch === branchId)?.quantity || 0;

/** Moves stock from one branch to another; both sides are recorded as stock movements. */
export default function StockTransferModal({ open, onClose, item, itemType, branches }) {
  const t = useT();
  const firstWithStock = branches.find((b) => atBranch(item, b._id) > 0)?._id || branches[0]?._id || '';
  const form = useForm({ values: { from: firstWithStock, to: branches.find((b) => b._id !== firstWithStock)?._id || '', quantity: '', note: '' } });
  const from = form.watch('from');
  const available = atBranch(item, from);
  const save = useMutationToast((body) => inventoryApi.transfer(body), {
    success: 'Stock transferred',
    invalidate: ['inventory', 'materials', 'material', 'products'],
    onSuccess: onClose,
  });
  const submit = form.handleSubmit((v) => save.mutate({ itemType, itemId: item._id, from: v.from, to: v.to, quantity: Number(v.quantity), note: v.note || undefined }));
  const options = branches.map((b) => ({ value: b._id, label: `${b.name} (${number(atBranch(item, b._id))} ${item?.unit || ''})`.trim() }));

  return (
    <Modal open={open} onClose={onClose} title={`Transfer stock — ${item?.name}`} footer={<Button loading={save.isPending} onClick={submit}>{t('Transfer')}</Button>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={t('From')} options={options} {...form.register('from', { required: true })} />
          <Select label="To" options={options} error={form.formState.errors.to && 'Choose a different branch'} {...form.register('to', { required: true, validate: (v) => v !== form.getValues('from') })} />
        </div>
        <Input
          label={t('Quantity')}
          type="number"
          step="any"
          min="0"
          max={available}
          hint={`${number(available)} ${item?.unit || ''} available at the source branch`}
          required
          error={form.formState.errors.quantity && `Between 1 and ${number(available)}`}
          {...form.register('quantity', { required: true, validate: (v) => Number(v) > 0 && Number(v) <= available })}
        />
        <Input label={t('Note (optional)')} placeholder="e.g. For the Bahir Dar showroom display" {...form.register('note')} />
      </div>
    </Modal>
  );
}
