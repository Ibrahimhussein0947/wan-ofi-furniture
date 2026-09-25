import { Link } from 'react-router-dom';
import { AlertCircle, ArrowDownCircle, ArrowUpCircle, Banknote, CalendarDays, CircleDollarSign, HandCoins, Receipt, ShieldCheck, Wallet } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { Card, PageHeader, StatCard } from '../../../components/ui/misc';
import { TrendChart, DonutChart } from '../../../components/charts/Charts';
import { RecentTransactions } from './OwnerDashboard';
import { money } from '../../../utils/format';

export default function AccountantDashboard({ data }) {
  const k = data.kpis;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        subtitle="Income, expenses, payments and debts"
        actions={
          <>
            <Button to="/app/payments?record=customer" icon={Banknote}>
              Record payment
            </Button>
            <Button to="/app/expenses?record=1" variant="secondary" icon={Receipt}>
              Record expense
            </Button>
            <Button to="/app/reports" variant="secondary">
              Reports
            </Button>
          </>
        }
      />

      {(k.pendingVerification > 0 || k.overdueInvoices > 0 || k.pendingExpenses > 0) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {k.pendingVerification > 0 && (
            <Link to="/app/payments?status=PENDING_VERIFICATION" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <ShieldCheck className="h-5 w-5" /> {k.pendingVerification} customer payment(s) to verify
            </Link>
          )}
          {k.overdueInvoices > 0 && (
            <Link to="/app/invoices?overdue=true" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-5 w-5" /> {k.overdueInvoices} overdue invoice(s)
            </Link>
          )}
          {k.pendingExpenses > 0 && (
            <Link to="/app/expenses?status=PENDING" className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
              <Receipt className="h-5 w-5" /> {k.pendingExpenses} expense(s) awaiting owner approval
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Today's income" value={money(k.todayIncome)} icon={CalendarDays} tone="green" />
        <StatCard label="Monthly income" value={money(k.monthIncome)} icon={ArrowDownCircle} tone="green" />
        <StatCard label="Monthly expenses" value={money(k.monthExpenses)} icon={ArrowUpCircle} tone="red" />
        <StatCard label="Net profit (month)" value={money(k.netProfit)} icon={Wallet} tone={k.netProfit >= 0 ? 'green' : 'red'} />
        <StatCard label="Outstanding customer payments" value={money(k.outstandingCustomer)} icon={HandCoins} tone="brass" to="/app/reports?report=customer-debts" />
        <StatCard label="Outstanding supplier payments" value={money(k.outstandingSupplier)} icon={CircleDollarSign} tone="red" to="/app/reports?report=supplier-debts" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Income vs expenses" subtitle="Last 6 months" className="xl:col-span-2">
          <TrendChart
            data={data.revenueSeries}
            series={[
              { key: 'income', name: 'Income' },
              { key: 'expenses', name: 'Expenses', color: '#b45353' },
            ]}
            height={260}
          />
        </Card>
        <Card title="Payments by method" subtitle="This month">
          {data.paymentStats.length ? <DonutChart data={data.paymentStats} nameKey="method" valueKey="amount" height={200} /> : <p className="text-sm text-stone-500">No payments this month.</p>}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recent transactions" padded={false} actions={<Link to="/app/accounting" className="link text-sm">Ledger</Link>}>
          <RecentTransactions rows={data.recentTransactions} />
        </Card>
        <Card title="Top customer debts" padded={false} actions={<Link to="/app/reports?report=customer-debts" className="link text-sm">Debt report</Link>}>
          {!data.topDebtors.length ? (
            <p className="p-5 text-sm text-stone-500">No outstanding customer balances.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.topDebtors.map((d) => (
                <li key={d.customerId}>
                  <Link to={`/app/customers/${d.customerId}`} className="flex justify-between px-5 py-3 text-sm hover:bg-stone-50">
                    <span>
                      <span className="block font-medium">{d.name}</span>
                      <span className="text-xs text-stone-500">
                        {d.phone} · {d.orders} order(s)
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums text-brass-800">{money(d.balance)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
