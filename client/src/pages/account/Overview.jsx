import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CircleDollarSign, Clock, Package, PencilRuler, ShoppingBag, CheckCircle2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, StatCard, ProgressBar } from '../../components/ui/misc';
import { StatusBadge } from '../../components/ui/Badge';
import { QueryState, EmptyState } from '../../components/ui/States';
import { dashboardApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { date, money, timeAgo } from '../../utils/format';
import { useT } from '../../i18n/LanguageContext';

export default function Overview() {
  const t = useT();
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });

  return (
    <QueryState query={query}>
      {(d) => (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-semibold text-walnut-950">{t('Hello, {name}', { name: user?.name?.split(' ')[0] })}</h1>
              <p className="text-stone-600">{t("Here's what's happening with your furniture.")}</p>
            </div>
            <div className="flex gap-2">
              <Button to="/products" variant="secondary" icon={ShoppingBag}>
                {t('Shop')}
              </Button>
              <Button to="/custom-furniture" icon={PencilRuler}>
                {t('Custom request')}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t('Active orders')} value={d.kpis.activeOrders} icon={Package} to="/account/orders" />
            <StatCard label={t('Balance due')} value={money(d.kpis.balanceDue)} icon={CircleDollarSign} tone={d.kpis.balanceDue > 0 ? 'brass' : 'green'} />
            <StatCard label={t('Completed')} value={d.kpis.completedOrders} icon={CheckCircle2} tone="green" />
            <StatCard label={t('Payments being verified')} value={d.kpis.pendingPayments} icon={Clock} tone="blue" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title={t('Active orders')} className="lg:col-span-2" padded={false} actions={<Link to="/account/orders" className="link text-sm">{t('All orders')}</Link>}>
              {!d.activeOrders.length ? (
                <EmptyState title={t('No active orders')} message="When you place an order, you'll follow its progress here." action={<Button to="/products">{t('Browse furniture')}</Button>} />
              ) : (
                <ul className="divide-y divide-stone-100">
                  {d.activeOrders.map((o) => {
                    const paidPct = o.total ? (o.amountPaid / o.total) * 100 : 0;
                    return (
                      <li key={o._id}>
                        <Link to={`/account/orders/${o._id}`} className="block px-5 py-4 hover:bg-stone-50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-walnut-950">{o.orderNumber}</p>
                              <p className="text-sm text-stone-500">{o.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}</p>
                            </div>
                            <StatusBadge status={o.status} />
                          </div>
                          <div className="mt-3 grid gap-3 text-xs text-stone-600 sm:grid-cols-2">
                            <div>
                              <p className="mb-1">
                                Paid {money(o.amountPaid)} of {money(o.total)}
                              </p>
                              <ProgressBar value={paidPct} tone={paidPct >= 100 ? 'green' : 'brass'} />
                            </div>
                            <p className="sm:text-right">
                              {t('Expected:')} <span className="font-medium text-stone-800">{date(o.expectedCompletionDate)}</span>
                              {o.status === 'PENDING' && o.amountPaid < o.depositRequired && (
                                <span className="block text-brass-700">{t('Pay the {amount} deposit to confirm', { amount: money(o.depositRequired) })}</span>
                              )}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card title={t('Notifications')} padded={false} actions={<Link to="/account/notifications" className="link text-sm">{t('View all')}</Link>}>
              <ul className="divide-y divide-stone-100">
                {!d.notifications.length && <li className="p-5 text-sm text-stone-500">{t('No notifications yet.')}</li>}
                {d.notifications.map((n) => (
                  <li key={n._id} className="px-5 py-3">
                    <p className="text-sm font-medium text-stone-800">{n.title}</p>
                    <p className="text-xs text-stone-500">{timeAgo(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title={t('Custom requests')} padded={false} actions={<Link to="/account/custom-requests" className="link text-sm">{t('View all')}</Link>}>
              <ul className="divide-y divide-stone-100">
                {!d.customRequests.length && <li className="p-5 text-sm text-stone-500">{t('No custom requests yet.')}</li>}
                {d.customRequests.map((r) => (
                  <li key={r._id}>
                    <Link to={`/account/custom-requests/${r._id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-stone-50">
                      <span>
                        <span className="block text-sm font-medium">{r.furnitureType}</span>
                        <span className="text-xs text-stone-500">
                          {r.requestNumber}
                          {r.quotedPrice ? ` · Quote ${money(r.quotedPrice)}` : ''}
                        </span>
                      </span>
                      <StatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title={t('Recent invoices')} padded={false} actions={<Link to="/account/invoices" className="link text-sm">{t('View all')}</Link>}>
              <ul className="divide-y divide-stone-100">
                {!d.invoices.length && <li className="p-5 text-sm text-stone-500">{t('No invoices yet.')}</li>}
                {d.invoices.map((inv) => (
                  <li key={inv._id}>
                    <Link to={`/account/invoices/${inv._id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-stone-50">
                      <span>
                        <span className="block text-sm font-medium">{inv.invoiceNumber}</span>
                        <span className="text-xs text-stone-500">
                          {date(inv.issueDate)} · {t('Balance')} {money(inv.balance)}
                        </span>
                      </span>
                      <StatusBadge status={inv.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </QueryState>
  );
}
