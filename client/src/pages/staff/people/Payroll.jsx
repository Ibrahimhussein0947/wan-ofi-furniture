import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Banknote } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { FilterBar, PageHeader, ProgressBar } from '../../../components/ui/misc';
import { Input, Select } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { paymentsApi, workersApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import useListParams from '../../../hooks/useListParams';
import useMutationToast from '../../../hooks/useMutationToast';
import { label, localDate, money, number } from '../../../utils/format';
import { PAYMENT_METHODS } from '../../../utils/constants';
import { useT } from '../../../i18n/LanguageContext';

const thisMonth = () => localDate().slice(0, 7);
const monthName = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function PayModal({ row, month, onClose }) {
  const t = useT();
  const form = useForm({ values: { amount: row?.due || '', method: 'BANK_TRANSFER', reference: '' } });
  const pay = useMutationToast((body) => paymentsApi.worker(body), { success: 'Wage payment recorded', invalidate: ['payroll', 'workers', 'payments'], onSuccess: onClose });
  const submit = form.handleSubmit((v) =>
    pay.mutate({ worker: row.worker._id, amount: Number(v.amount), method: v.method, reference: v.reference || undefined, kind: 'WAGE', period: monthName(month), payPeriod: month })
  );
  return (
    <Modal open={Boolean(row)} onClose={onClose} title={row && `Pay ${row.worker.name} · ${monthName(month)}`} size="sm" footer={<Button loading={pay.isPending} onClick={submit}>{t('Record payment')}</Button>}>
      {row && (
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Earned {money(row.earned)}
            {row.tax > 0 ? `, tax ${money(row.tax)} (${row.taxRate}%) → net ${money(row.net)}` : ''}, already paid {money(row.paid)}. Adjust the amount for absences or overtime before paying.
          </p>
          <Input label={t('Amount')} type="number" step="any" min="0.01" required error={form.formState.errors.amount && 'Enter an amount'} {...form.register('amount', { required: true, min: 0.01 })} />
          <Select label={t('Method')} options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(label(m)) }))} {...form.register('method')} />
          <Input label={t('Reference')} placeholder={t('Bank or mobile-money reference')} {...form.register('reference')} />
        </div>
      )}
    </Modal>
  );
}

export default function Payroll() {
  const t = useT();
  const [params, set] = useListParams();
  const month = params.month || thisMonth();
  const { can } = useAuth();
  const [paying, setPaying] = useState(null);
  const query = useQuery({ queryKey: ['payroll', month], queryFn: () => workersApi.payroll(month) });
  const rows = query.data?.rows;
  const totals = (rows || []).reduce((sum, r) => ({ earned: sum.earned + r.earned, tax: sum.tax + r.tax, net: sum.net + r.net, paid: sum.paid + r.paid, due: sum.due + r.due }), { earned: 0, tax: 0, net: 0, paid: 0, due: 0 });

  return (
    <div>
      <PageHeader
        title={t('Payroll')}
        subtitle="The system counts each worker's pay from their wage type — hours logged (hourly), jobs completed (per job), working days (daily/weekly) or the monthly rate — then withholds their admin-set tax rate and subtracts wages already paid. What remains is the net due."
      />
      <FilterBar>
        <Input type="month" value={month} max={thisMonth()} onChange={(e) => set({ month: e.target.value || '' })} aria-label={t('Month')} containerClassName="sm:w-48" />
        {query.data && (
          <p className="text-sm text-stone-600">
            {query.data.workingDays} working days (Mon–Sat){month === thisMonth() ? ' so far' : ''} · net due {money(totals.due)} of {money(totals.net)} · tax withheld {money(totals.tax)}
          </p>
        )}
      </FilterBar>
      <DataTable
        loading={query.isLoading}
        error={query.error}
        rows={rows}
        rowKey={(r) => r.worker._id}
        columns={[
          {
            key: 'worker',
            header: 'Worker',
            render: (r) => (
              <Link to={`/app/workers/${r.worker._id}`} className="hover:underline">
                <span className="font-medium text-stone-900">{r.worker.name}</span>
                <span className="block text-xs text-stone-500">{t(label(r.worker.position))}</span>
              </Link>
            ),
          },
          { key: 'wageType', header: 'Pay type', render: (r) => `${t(label(r.wageType))} · ${money(r.wageRate)}` },
          {
            key: 'work',
            header: 'Work this month',
            mobile: false,
            render: (r) => (
              <span className="text-sm">
                {number(r.hoursLogged)} h · {r.jobsCompleted + r.tasksCompleted} job{r.jobsCompleted + r.tasksCompleted === 1 ? '' : 's'}
              </span>
            ),
          },
          { key: 'basis', header: 'Paid for', mobile: false, render: (r) => `${number(r.units)} ${r.unit}` },
          { key: 'earned', header: 'Earned', align: 'right', render: (r) => money(r.earned) },
          {
            key: 'tax',
            header: 'Tax',
            align: 'right',
            render: (r) => (r.taxRate > 0 ? <span>{money(r.tax)} <span className="text-xs text-stone-500">({r.taxRate}%)</span></span> : <span className="text-stone-400">—</span>),
          },
          { key: 'net', header: 'Net', align: 'right', render: (r) => money(r.net) },
          { key: 'paid', header: 'Paid', align: 'right', render: (r) => money(r.paid) },
          {
            key: 'taxLevel',
            header: 'Tax reached',
            mobile: false,
            render: (r) =>
              r.tax > 0 ? (
                <div className="flex items-center gap-2">
                  <ProgressBar value={(r.taxWithheld / r.tax) * 100} className="w-20" tone={r.taxRemaining <= 0 ? 'green' : 'brass'} />
                  <span className="whitespace-nowrap text-xs text-stone-500">
                    {money(r.taxWithheld)} / {money(r.tax)}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-stone-400">No tax</span>
              ),
          },
          { key: 'due', header: 'Due', align: 'right', render: (r) => (r.due > 0 ? <span className="font-semibold">{money(r.due)}</span> : r.paid > r.net ? <Badge tone="amber">Overpaid {money(r.paid - r.net)}</Badge> : <Badge tone="green">{t('Paid')}</Badge>) },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (r) =>
              can('payments:write') &&
              r.due > 0 && (
                <Button size="sm" icon={Banknote} onClick={() => setPaying(r)}>
                  {t('Pay')}
                </Button>
              ),
          },
        ]}
      />
      <PayModal row={paying} month={month} onClose={() => setPaying(null)} />
    </div>
  );
}
