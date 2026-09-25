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

export function RecentTransactions({ rows }) {
  return (
    <ul className="divide-y divide-stone-100">
      {rows.map((t) => (
        <li key={t._id} className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-stone-800">{t.description}</p>
            <p className="text-xs text-stone-500">
              {label(t.type)} · {date(t.date)}
              {t.method && ` · ${label(t.method)}`}
            </p>
          </div>
          <span className={`shrink-0 text-sm font-semibold tabular-nums ${t.direction === 'IN' ? 'text-emerald-700' : t.direction === 'OUT' ? 'text-red-600' : 'text-stone-500'}`}>
            {t.direction === 'IN' ? '+' : t.direction === 'OUT' ? '−' : ''}
            {money(t.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function OwnerDashboard({ data }) {
  const { user } = useAuth();
  const k = data.kpis;
  const production = data.productionStatus.map((p) => ({ stage: label(p.stage), count: p.count }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good day, ${user?.name?.split(' ')[0]}`}
        subtitle="Your business at a glance"
        actions={
          <>
            <Button to="/app/orders/new" icon={ShoppingCart}>
              New order
            </Button>
            <Button to="/app/analytics" variant="secondary">
              Analytics
            </Button>
          </>
        }
      />

      {(k.pendingApprovals > 0 || k.delayedJobs > 0 || k.lowStockMaterials > 0 || k.pendingCustomRequests > 0) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {k.pendingApprovals > 0 && (
            <Link to="/app/expenses?status=PENDING" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 hover:bg-amber-100">
              <Receipt className="h-5 w-5" /> {k.pendingApprovals} expense(s) awaiting your approval
            </Link>
          )}
          {k.delayedJobs > 0 && (
            <Link to="/app/production?overdue=true" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 hover:bg-red-100">
              <Clock className="h-5 w-5" /> {k.delayedJobs} production job(s) delayed
            </Link>
          )}
          {k.lowStockMaterials > 0 && (
            <Link to="/app/materials?lowStock=true" className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 hover:bg-orange-100">
              <AlertTriangle className="h-5 w-5" /> {k.lowStockMaterials} material(s) low on stock
            </Link>
          )}
          {k.pendingCustomRequests > 0 && (
            <Link to="/app/custom-orders?status=SUBMITTED,UNDER_REVIEW,ESTIMATED" className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 hover:bg-sky-100">
              <PencilRuler className="h-5 w-5" /> {k.pendingCustomRequests} custom request(s) to quote
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total sales" value={money(k.totalSales, { compact: true })} icon={TrendingUp} hint={`${money(k.monthlySales, { compact: true })} this month`} />
        <StatCard label="Today's sales" value={money(k.todaySales)} icon={CalendarDays} tone="brass" hint={`${k.todayOrders} order(s) today`} />
        <StatCard label="Net profit (cash)" value={money(k.netProfit, { compact: true })} icon={k.netProfit >= 0 ? Banknote : TrendingDown} tone={k.netProfit >= 0 ? 'green' : 'red'} hint={`This month: ${money(k.monthProfit, { compact: true })}`} trend={k.monthProfit >= 0 ? 'up' : 'down'} />
        <StatCard label="Total expenses" value={money(k.totalExpenses, { compact: true })} icon={Receipt} tone="red" hint={`This month: ${money(k.monthExpenses, { compact: true })}`} />
        <StatCard label="Pending orders" value={k.pendingOrders} icon={ShoppingCart} tone="blue" to="/app/orders?status=PENDING" hint={`${k.activeOrders} active`} />
        <StatCard label="Completed orders" value={k.completedOrders} icon={PackageCheck} tone="green" to="/app/orders?status=DELIVERED,COMPLETED" />
        <StatCard label="Active production" value={k.activeProductionJobs} icon={Factory} tone="violet" to="/app/production" hint={k.delayedJobs ? `${k.delayedJobs} delayed` : 'On schedule'} />
        <StatCard label="Customer debts" value={money(k.customerDebt, { compact: true })} icon={HandCoins} tone="brass" to="/app/reports?report=customer-debts" hint={`${k.debtorCustomers} customer(s) · supplier dues ${money(k.supplierDebt, { compact: true })}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Revenue, expenses & profit" subtitle="Last 12 months (cash basis)" className="xl:col-span-2">
          <TrendChart
            data={data.revenueSeries}
            series={[
              { key: 'income', name: 'Income' },
              { key: 'expenses', name: 'Expenses', color: '#b45353' },
              { key: 'profit', name: 'Profit', color: '#5f7f63' },
            ]}
          />
        </Card>
        <Card title="Production status" subtitle="Jobs by stage">
          {production.length ? <BarsChart data={production} xKey="stage" series={[{ key: 'count', name: 'Jobs' }]} horizontal count height={260} formatX={(v) => v} /> : <p className="text-sm text-stone-500">No active jobs.</p>}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Sales trend" subtitle="Last 30 days" className="xl:col-span-2">
          <BarsChart data={data.salesTrend} xKey="date" series={[{ key: 'sales', name: 'Sales' }]} formatX={(d) => d.slice(5)} height={240} />
        </Card>
        <Card title="Expenses by category" subtitle="This year">
          {data.expenseByCategory.length ? <DonutChart data={data.expenseByCategory} nameKey="category" valueKey="amount" height={200} /> : <p className="text-sm text-stone-500">No expenses yet.</p>}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Recent orders" padded={false} className="xl:col-span-2" actions={<Link to="/app/orders" className="link text-sm">All orders</Link>}>
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
        <Card title="Recent transactions" padded={false} actions={<Link to="/app/accounting" className="link text-sm">Ledger</Link>}>
          <RecentTransactions rows={data.recentTransactions} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Low-stock materials" padded={false} actions={<Link to="/app/materials?lowStock=true" className="link text-sm">View</Link>}>
          {!data.lowStock.length ? (
            <p className="p-5 text-sm text-stone-500">All materials are above their minimum levels.</p>
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
        <StatCard label="Customers" value={k.customers} icon={Users} to="/app/customers" />
        <StatCard label="Active workers" value={k.workers} icon={ClipboardCheck} tone="violet" to="/app/workers" />
        <StatCard label="Outstanding supplier payments" value={money(k.supplierDebt)} icon={CircleDollarSign} tone="red" to="/app/reports?report=supplier-debts" />
      </div>
    </div>
  );
}
