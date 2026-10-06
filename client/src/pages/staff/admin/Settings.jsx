import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { Card, PageHeader } from '../../../components/ui/misc';
import { Checkbox, Input, Select, Textarea } from '../../../components/ui/Field';
import { QueryState } from '../../../components/ui/States';
import { settingsApi } from '../../../api/endpoints';
import { errorMessage } from '../../../api/client';
import { label, setCurrency } from '../../../utils/format';
import BranchSelect from '../../../components/BranchSelect';
import { useT } from '../../../i18n/LanguageContext';

// Local account numbers need 5–34 letters/digits (spaces/dashes allowed); IBAN-looking
// values are checked against the registered per-country IBAN length.
const IBAN_LENGTHS = {
  DE: 22,
  FR: 27,
  GB: 22,
  IT: 27,
  ES: 24,
  NL: 18,
  BE: 16,
  CH: 21,
  AT: 20,
  SE: 24,
  NO: 15,
  DK: 18,
  FI: 18,
  PL: 28,
  PT: 25,
  IE: 22,
  GR: 27,
  CZ: 24,
  AE: 23,
  SA: 24,
  TR: 26,
  EG: 29,
  KE: 28,
  QA: 29,
  KW: 30,
  BH: 22,
  JO: 30,
  IL: 23,
};
function accountNumberError(value) {
  const raw = String(value || '').trim();
  if (!/^[\dA-Za-z][\dA-Za-z\s-]{4,59}$/.test(raw))
    return 'Only letters, digits, spaces and dashes (5–60 characters).';
  const compact = raw.replace(/[\s-]/g, '').toUpperCase();
  if (/^[A-Z]{2}\d{2}/.test(compact)) {
    const expected = IBAN_LENGTHS[compact.slice(0, 2)];
    if (expected && compact.length !== expected)
      return `A ${compact.slice(0, 2)} IBAN must be ${expected} characters (got ${compact.length}).`;
    if (!expected && compact.length > 34) return 'An IBAN can be at most 34 characters.';
  }
  return null;
}

const emptyAccount = {
  type: 'BANK',
  bankName: '',
  accountName: '',
  accountNumber: '',
  branch: '',
  notes: '',
  isActive: true,
};

function SettingsForm({ settings }) {
  const t = useT();
  const qc = useQueryClient();
  const form = useForm({
    defaultValues: {
      ...settings,
      defaultBranch: settings.defaultBranch || '',
      bankAccounts: settings.bankAccounts || [],
      socialLinks: { facebook: '', telegram: '', whatsapp: '', instagram: '', ...settings.socialLinks },
    },
  });
  const accounts = useFieldArray({ control: form.control, name: 'bankAccounts' });
  const numbers = [
    'taxRate',
    'depositPercent',
    'largeExpenseThreshold',
    'defaultDeliveryFee',
    'invoiceDueDays',
    'customWarrantyMonths',
  ];

  const save = async (v) => {
    // Drop untouched rows; every row that has anything must be complete.
    const bankAccounts = (v.bankAccounts || [])
      .map((a) => ({
        type: a.type || 'BANK',
        bankName: String(a.bankName || '').trim(),
        accountName: String(a.accountName || '').trim(),
        accountNumber: String(a.accountNumber || '').trim(),
        branch: String(a.branch || '').trim(),
        notes: String(a.notes || '').trim(),
        isActive: a.isActive !== false,
      }))
      .filter((a) => a.bankName || a.accountName || a.accountNumber);
    if (bankAccounts.some((a) => !a.bankName || !a.accountName || !a.accountNumber)) {
      toast.error(
        t(
          'Each bank account needs a bank name, account name and account number — or remove the row.',
        ),
      );
      return;
    }
    const invalid = bankAccounts.find((a) => accountNumberError(a.accountNumber));
    if (invalid) {
      toast.error(
        `${invalid.bankName || t('Account number')}: ${t(accountNumberError(invalid.accountNumber))}`,
      );
      return;
    }
    const body = {
      companyName: v.companyName,
      companyEmail: v.companyEmail,
      companyPhone: v.companyPhone,
      companyAddress: v.companyAddress,
      socialLinks: v.socialLinks,
      currency: v.currency,
      timezone: v.timezone,
      paymentInstructions: v.paymentInstructions,
      bankAccounts,
      allowOverpayment: v.allowOverpayment,
      requireEmailVerification: v.requireEmailVerification,
      defaultBranch: v.defaultBranch || null,
      requireFullPaymentBeforeDelivery: v.requireFullPaymentBeforeDelivery,
      ...Object.fromEntries(numbers.map((k) => [k, Number(v[k])])),
    };
    try {
      const saved = await settingsApi.update(body);
      setCurrency(saved.currency);
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['public-settings'] });
      toast.success('Settings saved');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <form onSubmit={form.handleSubmit(save)} className='space-y-6'>
      <Card title={t('Company')}>
        <div className='grid gap-4 sm:grid-cols-2'>
          <Input label={t('Company name')} {...form.register('companyName')} />
          <Input label={t('Email')} type='email' {...form.register('companyEmail')} />
          <Input label={t('Phone')} {...form.register('companyPhone')} />
          <Input label={t('Address')} {...form.register('companyAddress')} />
          <Input
            label={t('Currency code')}
            hint='e.g. ETB, KES, USD'
            {...form.register('currency')}
          />
          <Input
            label={t('Time zone')}
            hint={t('Used to group reports by day/month')}
            {...form.register('timezone')}
          />
        </div>
      </Card>
      <Card title={t('Social media & chat')}>
        <p className='mb-4 text-sm text-stone-500'>{t('Shown on the website footer and Contact page. Leave a box empty to hide it.')}</p>
        <div className='grid gap-4 sm:grid-cols-2'>
          <Input label='Facebook' placeholder='https://facebook.com/wanofi' hint={t('Page link or username')} {...form.register('socialLinks.facebook')} />
          <Input label='Telegram' placeholder='@wanofi' hint={t('Username or t.me link')} {...form.register('socialLinks.telegram')} />
          <Input label='WhatsApp' type='tel' placeholder='+251 911 223 344' hint={t('Phone number with country code')} {...form.register('socialLinks.whatsapp')} />
          <Input label='Instagram' placeholder='@wanofi' hint={t('Profile link or username')} {...form.register('socialLinks.instagram')} />
        </div>
      </Card>
      <Card title={t('Orders & payments')}>
        <div className='grid gap-4 sm:grid-cols-2'>
          <Input
            label={t('Deposit required (%)')}
            type='number'
            min='0'
            max='100'
            hint={t('Orders confirm automatically once this is paid')}
            {...form.register('depositPercent')}
          />
          <Input
            label={t('Default delivery fee')}
            type='number'
            min='0'
            {...form.register('defaultDeliveryFee')}
          />
          <Input
            label={t('Invoice due after (days)')}
            type='number'
            min='0'
            {...form.register('invoiceDueDays')}
          />
          <Input
            label={t('Warranty on custom pieces (months)')}
            type='number'
            min='0'
            max='120'
            hint={t('Catalogue products set their own warranty')}
            {...form.register('customWarrantyMonths')}
          />
          <Input
            label={t('VAT / tax rate (%)')}
            type='number'
            min='0'
            max='100'
            step='any'
            hint={t('Added to new orders; existing orders keep their rate')}
            {...form.register('taxRate')}
          />
          <Textarea
            label={t('Payment instructions shown to customers')}
            containerClassName='sm:col-span-2'
            rows={3}
            {...form.register('paymentInstructions')}
          />
          <Checkbox
            label={t('Allow payments above the remaining balance (overpayment)')}
            {...form.register('allowOverpayment')}
          />
          <Checkbox
            label={t('Require full payment before delivery / collection')}
            {...form.register('requireFullPaymentBeforeDelivery')}
          />
          <Checkbox
            label={t('Customers must confirm their email before ordering online')}
            {...form.register('requireEmailVerification')}
          />
          <BranchSelect
            label={t('Default branch for online orders')}
            placeholder={t('None')}
            hideIfSingle={false}
            value={form.watch('defaultBranch') || ''}
            onChange={(e) => form.setValue('defaultBranch', e.target.value)}
          />
        </div>
      </Card>
      <Card title={t('Bank accounts for customer payments')}>
        <p className='mb-4 text-sm text-stone-600'>
          {t(
            'Customers see these accounts when they pay for an order. Each account needs a bank name, account name and account number; uncheck "Show to customers" to hide one without deleting it.',
          )}
        </p>
        <div className='space-y-4'>
          {accounts.fields.map((f, i) => (
            <div
              key={f.id}
              className='grid gap-3 rounded-lg border border-stone-200 p-3 sm:grid-cols-2 lg:grid-cols-3'
            >
              <Select
                label={t('Type')}
                options={['BANK', 'MOBILE_WALLET'].map((v) => ({ value: v, label: t(label(v)) }))}
                {...form.register(`bankAccounts.${i}.type`)}
              />
              <Input
                label={t('Bank or wallet')}
                placeholder={t('e.g. Commercial Bank of Ethiopia')}
                {...form.register(`bankAccounts.${i}.bankName`)}
              />
              <Input
                label={t('Account name')}
                placeholder={t('e.g. Wan Ofi Furniture Ltd')}
                {...form.register(`bankAccounts.${i}.accountName`)}
              />
              <Input
                label={t('Account number')}
                placeholder={t('e.g. 0150-000000-00')}
                {...form.register(`bankAccounts.${i}.accountNumber`)}
              />
              <Input
                label={t('Branch (optional)')}
                {...form.register(`bankAccounts.${i}.branch`)}
              />
              <Input
                label={t('Note for customers (optional)')}
                {...form.register(`bankAccounts.${i}.notes`)}
              />
              <div className='flex items-center justify-between gap-3 sm:col-span-2 lg:col-span-3'>
                <Checkbox
                  label={t('Show to customers')}
                  {...form.register(`bankAccounts.${i}.isActive`)}
                />
                <button
                  type='button'
                  className='text-sm font-medium text-red-600 hover:underline'
                  onClick={() => accounts.remove(i)}
                >
                  {t('Remove')}
                </button>
              </div>
            </div>
          ))}
          <Button
            type='button'
            variant='secondary'
            icon={Plus}
            onClick={() => accounts.append({ ...emptyAccount })}
          >
            {t('Add bank account')}
          </Button>
        </div>
      </Card>
      <Card title={t('Approvals')}>
        <Input
          label={t('Expenses above this amount need owner approval')}
          type='number'
          min='0'
          containerClassName='max-w-sm'
          {...form.register('largeExpenseThreshold')}
        />
      </Card>
      <Button type='submit' size='lg' loading={form.formState.isSubmitting}>
        {t('Save settings')}
      </Button>
    </form>
  );
}

export default function Settings() {
  const t = useT();
  const query = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  return (
    <div className='max-w-4xl'>
      <PageHeader
        title={t('System settings')}
        subtitle={t('Only the owner can change these. Every change is recorded in the audit log.')}
      />
      <QueryState query={query}>{(settings) => <SettingsForm settings={settings} />}</QueryState>
    </div>
  );
}
