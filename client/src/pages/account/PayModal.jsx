import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { CheckCircle2, Loader2, Smartphone, XCircle } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import ImagePicker from '../../components/ui/ImagePicker';
import BankAccounts from '../../components/BankAccounts';
import { Tabs } from '../../components/ui/misc';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { paymentsApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import useMutationToast from '../../hooks/useMutationToast';
import { usePublicSettings } from '../../components/SettingsLoader';
import { label, money } from '../../utils/format';
import { useT } from '../../i18n/LanguageContext';

const NETWORKS = {
  TELEBIRR: 'Telebirr (Ethio Telecom)',
  CBE_BIRR: 'CBE Birr',
  AMOLE: 'Amole (Dashen Bank)',
  MPESA: 'M-PESA (Safaricom)',
};
const KEYS = ['order', 'orders', 'dashboard'];

function MobileMoney({ order, suggested, onDone }) {
  const t = useT();
  const { customer, user } = useAuth();
  const qc = useQueryClient();
  const { data: settings } = usePublicSettings();
  const [intent, setIntent] = useState(null);
  const [sending, setSending] = useState(false);
  const form = useForm({
    values: { network: 'TELEBIRR', phone: customer?.phone || user?.phone || '', amount: suggested },
  });

  // Poll until the customer approves or declines on their phone.
  useEffect(() => {
    if (!intent || ['SUCCEEDED', 'FAILED'].includes(intent.status)) return undefined;
    const timer = setInterval(async () => {
      try {
        const latest = await paymentsApi.mobileStatus(intent.reference);
        setIntent(latest);
        if (latest.status === 'SUCCEEDED') {
          toast.success('Payment received — thank you!');
          KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
        }
      } catch {
        // keep polling
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [intent, qc]);

  const start = form.handleSubmit(async (v) => {
    setSending(true);
    try {
      setIntent(
        await paymentsApi.mobile({
          order: order._id,
          network: v.network,
          phone: v.phone,
          amount: Number(v.amount),
        }),
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  });

  if (intent) {
    const done = intent.status === 'SUCCEEDED';
    const failed = intent.status === 'FAILED';
    return (
      <div className='py-4 text-center' aria-live='polite'>
        {done ? (
          <CheckCircle2 className='mx-auto h-12 w-12 text-sage-600' />
        ) : failed ? (
          <XCircle className='mx-auto h-12 w-12 text-red-500' />
        ) : (
          <Loader2 className='mx-auto h-12 w-12 animate-spin text-walnut-600' />
        )}
        <p className='mt-3 font-semibold'>
          {done
            ? `${money(intent.amount)} received`
            : failed
              ? 'Payment not completed'
              : 'Check your phone'}
        </p>
        <p className='mt-1 text-sm text-stone-600'>
          {done
            ? 'Your order has been updated and a receipt is in your account.'
            : failed
              ? intent.failureReason || 'The payment was declined or timed out.'
              : `We sent a ${NETWORKS[intent.network]} prompt to ${intent.phone}. Enter your PIN to approve ${money(intent.amount)}.`}
        </p>
        <div className='mt-5 flex justify-center gap-2'>
          {failed && (
            <Button variant='secondary' onClick={() => setIntent(null)}>
              {t('Try again')}
            </Button>
          )}
          {(done || failed) && <Button onClick={onDone}>{t('Close')}</Button>}
        </div>
        {!done && !failed && (
          <p className='mt-4 text-xs text-stone-400'>Reference {intent.reference}</p>
        )}
      </div>
    );
  }

  const networks = settings?.mobileNetworks?.length
    ? settings.mobileNetworks
    : Object.keys(NETWORKS);
  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-2'>
        {networks.map((n) => (
          <label
            key={n}
            className={clsx(
              'flex cursor-pointer items-center gap-2 rounded-lg border-2 p-3 text-sm',
              form.watch('network') === n ? 'border-walnut-700 bg-walnut-50' : 'border-stone-200',
            )}
          >
            <input
              type='radio'
              value={n}
              className='text-walnut-700'
              {...form.register('network')}
            />
            {NETWORKS[n] || n}
          </label>
        ))}
      </div>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Input
          label={t('Mobile number')}
          type='tel'
          placeholder='0911 345 678'
          required
          {...form.register('phone', { required: true, minLength: 9 })}
          error={form.formState.errors.phone && 'Enter the number to charge'}
        />
        <Input
          label={t('Amount')}
          type='number'
          min='1'
          step='any'
          required
          error={form.formState.errors.amount && `Enter an amount up to ${money(order.balance)}`}
          {...form.register('amount', { required: true, min: 1, max: order.balance })}
        />
      </div>
      <Button block size='lg' icon={Smartphone} loading={sending} onClick={start}>
        {t('Send payment prompt')}
      </Button>
      <p className='text-xs text-stone-500'>
        {t(
          "You'll receive a prompt on your phone. The payment is applied to your order automatically once you approve it.",
        )}
      </p>
    </div>
  );
}

function ManualTransfer({ order, suggested, onDone }) {
  const t = useT();
  const { data: settings } = usePublicSettings();
  const [screenshot, setScreenshot] = useState([]);
  const form = useForm({
    values: { amount: suggested, method: 'BANK_TRANSFER', reference: '', notes: '' },
  });
  const submit = useMutationToast((body) => paymentsApi.submit(body, screenshot[0]), {
    success: (p) => `Payment ${p.paymentNumber} submitted. We'll confirm it shortly.`,
    invalidate: KEYS,
    onSuccess: onDone,
  });
  return (
    <div className='space-y-4'>
      <BankAccounts />
      {settings?.paymentInstructions && (
        <p className='rounded-lg bg-brass-50 p-3 text-sm text-brass-900'>
          {settings.paymentInstructions}
        </p>
      )}
      <div className='grid gap-4 sm:grid-cols-2'>
        <Input
          label={t('Amount')}
          type='number'
          min='1'
          max={order.balance}
          step='any'
          required
          {...form.register('amount', { required: true, min: 1, max: order.balance })}
          error={form.formState.errors.amount && `Enter an amount up to ${money(order.balance)}`}
        />
        <Select
          label={t('Paid via')}
          options={['BANK_TRANSFER', 'MOBILE_PAYMENT', 'CARD', 'OTHER'].map((m) => ({
            value: m,
            label: label(m),
          }))}
          {...form.register('method')}
        />
      </div>
      <Input
        label={t('Transaction reference')}
        placeholder={t('Bank reference or mobile-money code')}
        required
        {...form.register('reference', { required: true, validate: (v) => v.trim().length >= 3 })}
        error={
          form.formState.errors.reference &&
          'Please enter the reference so we can match your payment'
        }
      />
      <div>
        <p className='mb-1 text-sm font-medium text-stone-700'>
          {t('Payment receipt')} <span className='font-normal text-stone-500'>({t('optional — you can add it later')})</span>
        </p>
        <ImagePicker files={screenshot} onChange={setScreenshot} max={1} label={t('Add receipt')} capture />
        <p className='mt-1 text-xs text-stone-500'>
          {t('Upload a photo or screenshot of the bank or mobile-money receipt showing the amount and reference.')}
        </p>
      </div>
      <Textarea label={t('Note (optional)')} rows={2} {...form.register('notes')} />
      <Button
        block
        loading={submit.isPending}
        onClick={form.handleSubmit((v) =>
          submit.mutate({ ...v, reference: v.reference.trim(), order: order._id, amount: Number(v.amount) }),
        )}
      >
        {t('Submit for verification')}
      </Button>
      <p className='text-xs text-stone-500'>
        {t('Your payment appears on the order once our accounts team verifies it.')}
      </p>
    </div>
  );
}

export default function PayModal({ order, open, onClose, initialTab }) {
  const t = useT();
  const { data: settings } = usePublicSettings();
  const online = Boolean(settings?.onlinePayments);
  const defaultTab = online && initialTab !== 'manual' ? 'mobile' : 'manual';
  const [tab, setTab] = useState(defaultTab);
  useEffect(() => setTab(defaultTab), [defaultTab, open]);
  const suggested =
    order.status === 'PENDING'
      ? Math.max(order.depositRequired - order.amountPaid, 0) || order.balance
      : order.balance;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Make a payment')}
      description={`Remaining balance: ${money(order.balance)}`}
    >
      {online && (
        <Tabs
          className='mb-4'
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'mobile', label: 'Mobile money' },
            { value: 'manual', label: 'Bank transfer / other' },
          ]}
        />
      )}
      {tab === 'mobile' ? (
        <MobileMoney order={order} suggested={suggested} onDone={onClose} />
      ) : (
        <ManualTransfer order={order} suggested={suggested} onDone={onClose} />
      )}
    </Modal>
  );
}
