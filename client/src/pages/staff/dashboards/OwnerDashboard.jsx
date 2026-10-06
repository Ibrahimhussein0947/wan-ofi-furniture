import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  Factory,
  HandCoins,
  PackageCheck,
  PencilRuler,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import { Card, PageHeader, StatCard } from '../../../components/ui/misc';
import { StatusBadge } from '../../../components/ui/Badge';
import { TrendChart, BarsChart, DonutChart } from '../../../components/charts/Charts';
import { useAuth } from '../../../context/AuthContext';
import { date, label, money } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

export function RecentTransactions({ rows }) {
  const t = useT();
  return (
    <ul className="divide-y divide-stone-100">
      {rows.map((tx) => (
        <li key={tx._id} className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-stone-800">{tx.description}</p>
            <p className="text-xs text-stone-500">
              {t(label(tx.type))} · {date(tx.date)}
              {tx.method && ` · ${t(label(tx.method))}`}
            </p>
          </div>
          <span className={`shrink-0 text-sm font-semibold tabular-nums ${tx.direction === 'IN' ? 'text-emerald-700' : tx.direction === 'OUT' ? 'text-red-600' : 'text-stone-500'}`}>
            {tx.direction === 'IN' ? '+' : tx.direction === 'OUT' ? '−' : ''}
            {money(tx.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function OwnerDashboard({ data }) {
  const t = useT();
  const { user } = useAuth();
  const k = data.kpis;
  const production = data.productionStatus.map((p) => ({ stage: t(label(p.stage)), count: p.count }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Good day, {name}', { name: user?.name?.split(' ')[0] })}
        subtitle={t('Your business at a glance')}
        actions={
          <>
            <Button to="/app/orders/new" icon={ShoppingCart}>
              {t('New order')}
            </Button>
            <Button to="/app/analytics" variant="secondary">
              {t('Analytics')}
            </Button>
          </>
        }
      />

      {(k.pendingApprovals > 0 || k.delayedJobs > 0 || k.lowStockMaterials > 0 || k.pendingCustomRequests > 0) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {k.pendingApprovals > 0 && (
            <Link to="/app/expenses?status=PENDING" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 hover:bg-amber-100">
              <Receipt className="h-5 w-5" /> {t('{count} expense(s) awaiting your approval', { count: k.pendingApprovals })}
            </Link>
          )}
          {k.delayedJobs > 0 && (
            <Link to="/app/production?overdue=true" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 hover:bg-red-100">
              <Clock className="h-5 w-5" /> {t('{count} production job(s) delayed', { count: k.delayedJobs })}
            </Link>
          )}
          {k.lowStockMaterials > 0 && (
            <Link to="/app/materials?lowStock=true" className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 hover:bg-orange-100">
              <AlertTriangle className="h-5 w-5" /> {t('{count} material(s) low on stock', { count: k.lowStockMaterials })}
            </Link>
          )}
          {k.pendingCustomRequests > 0 && (
            <Link to="/app/custom-orders?status=SUBMITTED,UNDER_REVIEW,ESTIMATED" className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 hover:bg-sky-100">
              <PencilRuler className="h-5 w-5" /> {t('{count} custom request(s) to quote', { count: k.pendingCustomRequests })}
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('Total sales')} value={money(k.totalSales, { compact: true })} icon={TrendingUp} hint={t('{amount} this month', { amount: money(k.monthlySales, { compact: true }) })} />
        <StatCard label={t("Today's sales")} value={money(k.todaySales)} icon={CalendarDays} tone="brass" hint={t('{count} order(s) today', { count: k.todayOrders })} />
        <StatCard label={t('Net profit (cash)')} value={money(k.netProfit, { compact: true })} icon={k.netProfit >= 0 ? Banknote : TrendingDown} tone={k.netProfit >= 0 ? 'green' : 'red'} hint={t('This month: {amount}', { amount: money(k.monthProfit, { compact: true }) })} trend={k.monthProfit >= 0 ? 'up' : 'down'} />
        <StatCard label={t('Total expenses')} value={money(k.totalExpenses, { compact: true })} icon={Receipt} tone="red" hint={t('This month: {amount}', { amount: money(k.monthExpenses, { compact: true }) })} />
        <StatCard label={t('Pending orders')} value={k.pendingOrders} icon={ShoppingCart} tone="blue" to="/app/orders?status=PENDING" hint={t('{count} active', { count: k.activeOrders })} />
        <StatCard label={t('Completed orders')} value={k.completedOrders} icon={PackageCheck} tone="green" to="/app/orders?status=DELIVERED,COMPLETED" />
        <StatCard label={t('Active production')} value={k.activeProductionJobs} icon={Factory} tone="violet" to="/app/production" hint={k.delayedJobs ? t('{count} delayed', { count: k.delayedJobs }) : t('On schedule')} />
        <StatCard label={t('Customer debts')} value={money(k.customerDebt, { compact: true })} icon={HandCoins} tone="brass" to="/app/reports?report=customer-debts" hint={t('{count} customer(s) · supplier dues {amount}', { count: k.debtorCustomers, amount: money(k.supplierDebt, { compact: true }) })} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={t('Revenue, expenses & profit')} subtitle={t('Last 12 months (cash basis)')} className="xl:col-span-2">
          <TrendChart
            data={data.revenueSeries}
            series={[
              { key: 'income', name: 'Income' },
              { key: 'expenses', name: 'Expenses', color: '#b45353' },
              { key: 'profit', name: 'Profit', color: '#5f7f63' },
            ]}
          />
        </Card>
        <Card title={t('Production status')} subtitle={t('Jobs by stage')}>
          {production.length ? <BarsChart data={production} xKey="stage" series={[{ key: 'count', name: 'Jobs' }]} horizontal count height={260} formatX={(v) => v} /> : <p className="text-sm text-stone-500">{t('No active jobs.')}</p>}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={t('Sales trend')} subtitle={t('Last 30 days')} className="xl:col-span-2">
          <BarsChart data={data.salesTrend} xKey="date" series={[{ key: 'sales', name: 'Sales' }]} formatX={(d) => d.slice(5)} height={240} />
        </Card>
        <Card title={t('Expenses by category')} subtitle={t('This year')}>
          {data.expenseByCategory.length ? <DonutChart data={data.expenseByCategory} nameKey="category" valueKey="amount" height={200} /> : <p className="text-sm text-stone-500">{t('No expenses yet.')}</p>}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={t('Recent orders')} padded={false} className="xl:col-span-2" actions={<Link to="/app/orders" className="link text-sm">{t('All orders')}</Link>}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-100">
              <tbody className="divide-y divide-stone-100">
                {data.recentOrders.map((o) => (
                  <tr key={o._id} className="hover:bg-stone-50">
                    <td className="table-td">
                      <Link to={`/app/orders/${o._id}`} className="font-medium text-walnut-800 hover:underline">
                        {o.orderNumber}
                      </Link>
                      <p className="text-xs text-stone-500">{o.customer?.name}</p>
                    </td>
                    <td className="table-td">{date(o.orderDate)}</td>
                    <td className="table-td text-right tabular-nums">{money(o.total)}</td>
                    <td className="table-td">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={t('Recent transactions')} padded={false} actions={<Link to="/app/accounting" className="link text-sm">{t('Ledger')}</Link>}>
          <RecentTransactions rows={data.recentTransactions} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={t('Low-stock materials')} padded={false} actions={<Link to="/app/materials?lowStock=true" className="link text-sm">{t('View')}</Link>}>
          {!data.lowStock.length ? (
            <p className="p-5 text-sm text-stone-500">{t('All materials are above their minimum levels.')}</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.lowStock.map((m) => (
                <li key={m._id} className="flex justify-between px-5 py-2.5 text-sm">
                  <span>{m.name}</span>
                  <span className="font-medium text-red-600">
                    {m.quantity} / {m.minStock} {m.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <StatCard label={t('Customers')} value={k.customers} icon={Users} to="/app/customers" />
        <StatCard label={t('Active workers')} value={k.workers} icon={ClipboardCheck} tone="violet" to="/app/workers" />
        <StatCard label={t('Outstanding supplier payments')} value={money(k.supplierDebt)} icon={CircleDollarSign} tone="red" to="/app/reports?report=supplier-debts" />
      </div>
    </div>
  );
}
