import { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Field';
import { customersApi } from '../../../api/endpoints';
import useMutationToast from '../../../hooks/useMutationToast';
import { useT } from '../../../i18n/LanguageContext';

/** Adds a customer with just a name (and phone) so an order can be taken straight away. */
export default function QuickCustomerModal({ open, initialName = '', onClose, onSaved }) {
  const t = useT();
  const [typed, setTyped] = useState(null);
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);
  const name = typed ?? initialName;
  const create = useMutationToast((body) => customersApi.create(body), {
    success: 'Customer created',
    invalidate: ['customers', 'customer'],
    onSuccess: (customer) => {
      setTyped(null);
      setPhone('');
      setTouched(false);
      onSaved?.(customer);
    },
  });
  const submit = () => {
    setTouched(true);
    if (name.trim().length < 2) return;
    create.mutate({ name: name.trim(), phone: phone.trim() || undefined, source: 'WALK_IN' });
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('New customer')}
      description={t('Just a name is enough — you can add the rest later from the Customers page.')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button loading={create.isPending} onClick={submit}>
            {t('Create customer')}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          label={t('Customer name')}
          required
          autoFocus
          value={name}
          onChange={(e) => setTyped(e.target.value)}
          error={touched && name.trim().length < 2 ? t('Enter the customer’s name') : undefined}
        />
        <Input label={t('Phone (optional)')} type="tel" placeholder="0911 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </form>
    </Modal>
  );
}
