import { useQuery } from '@tanstack/react-query';
import { Card, PageHeader, StatCard } from '../../components/ui/misc';
import { QueryState } from '../../components/ui/States';
import { BarsChart, TrendChart } from '../../components/charts/Charts';
import { dashboardApi } from '../../api/endpoints';
import { money, number } from '../../utils/format';
import { HandCoins, Users, CircleDollarSign } from 'lucide-react';

export default function Analytics() {
  const query = useQuery({ queryKey: ['analytics'], queryFn: dashboardApi.analytics });
  return (
    <QueryState query={query}>
      {(a) => (
        <div className="space-y-6">
          <PageHeader title="Business analytics" subtitle="The last 12 months across sales, finance, production and customers" />
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Outstanding customer debt" value={money(a.outstandingDebt.customerDebt)} icon={HandCoins} tone="brass" hint={`${a.outstandingDebt.debtorOrders} unpaid order(s)`} />
            <StatCard label="Customers with debt" value={a.outstandingDebt.debtorCustomers} icon={Users} tone="blue" />
            <StatCard label="Owed to suppliers" value={money(a.outstandingDebt.supplierDebt)} icon={CircleDollarSign} tone="red" />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Revenue over time" subtitle="Sales booked vs cash income">
              <TrendChart data={a.revenueSeries} series={[{ key: 'sales', name: 'Sales' }, { key: 'income', name: 'Income' }]} />
            </Card>
            <Card title="Expenses & profit over time">
              <TrendChart data={a.revenueSeries} type="line" series={[{ key: 'expenses', name: 'Expenses', color: '#b45353' }, { key: 'profit', name: 'Profit', color: '#5f7f63' }]} />
            </Card>
            <Card title="Orders over time">
              <BarsChart data={a.revenueSeries} xKey="period" series={[{ key: 'orders', name: 'Orders' }]} count />
            </Card>
            <Card title="Payment collection" subtitle="Sales vs money collected">
              <BarsChart data={a.paymentCollection} xKey="period" series={[{ key: 'sales', name: 'Sales' }, { key: 'collected', name: 'Collected', color: '#5f7f63' }]} />
            </Card>
            <Card title="Most sold furniture" subtitle="Units sold">
              <BarsChart data={a.mostSold} xKey="name" series={[{ key: 'quantity', name: 'Units' }]} horizontal count height={320} formatX={(v) => v} />
            </Card>
            <Card title="Most profitable furniture" subtitle="Revenue minus recorded cost">
              <BarsChart data={a.mostProfitable} xKey="name" series={[{ key: 'profit', name: 'Profit', color: '#5f7f63' }]} horizontal height={320} formatX={(v) => v} />
            </Card>
            <Card title="Material consumption" subtitle="Value issued to production">
              {a.materialConsumption.length ? (
                <BarsChart data={a.materialConsumption.map((m) => ({ ...m, label: `${m.material} (${number(m.used)} ${m.unit})` }))} xKey="label" series={[{ key: 'cost', name: 'Cost' }]} horizontal height={320} formatX={(v) => v} />
              ) : (
                <p className="text-sm text-stone-500">No materials issued yet.</p>
              )}
            </Card>
            <Card title="Production completion" subtitle="Jobs started vs completed">
              <BarsChart data={a.productionCompletion} xKey="period" series={[{ key: 'started', name: 'Started' }, { key: 'completed', name: 'Completed', color: '#5f7f63' }]} count />
            </Card>
            <Card title="Customer growth" subtitle="New customers per month" className="xl:col-span-2">
              <BarsChart data={a.customerGrowth} xKey="period" series={[{ key: 'newCustomers', name: 'New customers' }]} count height={240} />
            </Card>
          </div>
        </div>
      )}
    </QueryState>
  );
}
