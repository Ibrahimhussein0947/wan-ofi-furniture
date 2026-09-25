import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Button from '../../../components/ui/Button';
import { Card, PageHeader } from '../../../components/ui/misc';
import { Checkbox, Input, Textarea } from '../../../components/ui/Field';
import { QueryState } from '../../../components/ui/States';
import { settingsApi } from '../../../api/endpoints';
import { errorMessage } from '../../../api/client';
import { setCurrency } from '../../../utils/format';
import BranchSelect from '../../../components/BranchSelect';

function SettingsForm({ settings }) {
  const qc = useQueryClient();
  const form = useForm({ defaultValues: { ...settings, defaultBranch: settings.defaultBranch || '' } });
  const numbers = ['taxRate', 'depositPercent', 'largeExpenseThreshold', 'defaultDeliveryFee', 'invoiceDueDays'];

  const save = async (v) => {
    const body = {
      companyName: v.companyName,
      companyEmail: v.companyEmail,
      companyPhone: v.companyPhone,
      companyAddress: v.companyAddress,
      currency: v.currency,
      timezone: v.timezone,
      paymentInstructions: v.paymentInstructions,
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
    <form onSubmit={form.handleSubmit(save)} className="space-y-6">
      <Card title="Company">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Company name" {...form.register('companyName')} />
          <Input label="Email" type="email" {...form.register('companyEmail')} />
          <Input label="Phone" {...form.register('companyPhone')} />
          <Input label="Address" {...form.register('companyAddress')} />
          <Input label="Currency code" hint="e.g. TZS, KES, USD" {...form.register('currency')} />
          <Input label="Time zone" hint="Used to group reports by day/month" {...form.register('timezone')} />
        </div>
      </Card>
      <Card title="Orders & payments">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Deposit required (%)" type="number" min="0" max="100" hint="Orders confirm automatically once this is paid" {...form.register('depositPercent')} />
          <Input label="Default delivery fee" type="number" min="0" {...form.register('defaultDeliveryFee')} />
          <Input label="Invoice due after (days)" type="number" min="0" {...form.register('invoiceDueDays')} />
          <Input label="VAT / tax rate (%)" type="number" min="0" max="100" step="any" hint="Added to new orders; existing orders keep their rate" {...form.register('taxRate')} />
          <Textarea label="Payment instructions shown to customers" containerClassName="sm:col-span-2" rows={3} {...form.register('paymentInstructions')} />
          <Checkbox label="Allow payments above the remaining balance (overpayment)" {...form.register('allowOverpayment')} />
          <Checkbox label="Require full payment before delivery / collection" {...form.register('requireFullPaymentBeforeDelivery')} />
          <Checkbox label="Customers must confirm their email before ordering online" {...form.register('requireEmailVerification')} />
          <BranchSelect label="Default branch for online orders" placeholder="None" hideIfSingle={false} value={form.watch('defaultBranch') || ''} onChange={(e) => form.setValue('defaultBranch', e.target.value)} />
        </div>
      </Card>
      <Card title="Approvals">
        <Input label="Expenses above this amount need owner approval" type="number" min="0" containerClassName="max-w-sm" {...form.register('largeExpenseThreshold')} />
      </Card>
      <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
        Save settings
      </Button>
    </form>
  );
}

export default function Settings() {
  const query = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  return (
    <div className="max-w-4xl">
      <PageHeader title="System settings" subtitle="Only the owner can change these. Every change is recorded in the audit log." />
      <QueryState query={query}>{(settings) => <SettingsForm settings={settings} />}</QueryState>
    </div>
  );
}
