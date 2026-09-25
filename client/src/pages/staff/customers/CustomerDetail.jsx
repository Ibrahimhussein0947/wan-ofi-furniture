import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Pencil, ShoppingCart } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { Card, DetailList, PageHeader, StatCard, Tabs } from '../../../components/ui/misc';
import { StatusBadge } from '../../../components/ui/Badge';
import { QueryState } from '../../../components/ui/States';
import CustomerFormModal from './CustomerFormModal';
import { customersApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import { date, label, money } from '../../../utils/format';

export default function CustomerDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const [tab, setTab] = useState('orders');
  const [editing, setEditing] = useState(false);
  const query = useQuery({ queryKey: ['customer', id], queryFn: () => customersApi.get(id) });

  return (
    <QueryState query={query}>
      {(c) => (
        <div className="space-y-6">
          <PageHeader
            back="/app/customers"
            title={c.name}
            subtitle={`${c.customerCode} · customer since ${date(c.createdAt)}${c.user ? ' · has online account' : ' · walk-in'}`}
            actions={
              <>
                {can('orders:write') && (
                  <Button to="/app/orders/new" variant="secondary" icon={ShoppingCart}>
                    New order
                  </Button>
                )}
                {can('customers:write') && (
                  <Button icon={Pencil} onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )}
              </>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Outstanding balance" value={money(c.summary.balance)} tone={c.summary.balance > 0 ? 'brass' : 'green'} />
            <StatCard label="Total ordered" value={money(c.summary.totalSpent)} />
            <StatCard label="Total paid" value={money(c.summary.totalPaid)} tone="green" />
            <StatCard label="Orders" value={c.summary.orderCount} tone="blue" />
          </div>
          <Card title="Contact details">
            <DetailList
              columns={3}
              items={[
                { label: 'Phone', value: c.phone || '—' },
                { label: 'Email', value: c.email || '—' },
                { label: 'Company', value: c.company || '—' },
                { label: 'Address', value: [c.address?.street, c.address?.city, c.address?.region].filter(Boolean).join(', ') || '—' },
                { label: 'Source', value: label(c.source) },
                { label: 'Notes', value: c.notes || '—' },
              ]}
            />
          </Card>

          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'orders', label: 'Orders', count: c.orders.length },
              { value: 'payments', label: 'Payments', count: c.payments.length },
              { value: 'invoices', label: 'Invoices', count: c.invoices.length },
              { value: 'custom', label: 'Custom requests', count: c.customRequests.length },
            ]}
          />
          <div className="card overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-100">
              <tbody className="divide-y divide-stone-100">
                {tab === 'orders' &&
                  c.orders.map((o) => (
                    <tr key={o._id}>
                      <td className="table-td">
                        <Link to={`/app/orders/${o._id}`} className="link">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="table-td">{date(o.orderDate)}</td>
                      <td className="table-td text-right tabular-nums">{money(o.total)}</td>
                      <td className="table-td text-right tabular-nums">{money(o.balance)}</td>
                      <td className="table-td">
                        <StatusBadge status={o.status} />
                      </td>
                    </tr>
                  ))}
                {tab === 'payments' &&
                  c.payments.map((p) => (
                    <tr key={p._id}>
                      <td className="table-td">
                        <Link to={`/app/receipts/${p._id}`} className="link">
                          {p.receiptNumber || p.paymentNumber}
                        </Link>
                      </td>
                      <td className="table-td">{date(p.paidAt)}</td>
                      <td className="table-td">{label(p.method)}</td>
                      <td className="table-td text-right tabular-nums">{money(p.amount)}</td>
                      <td className="table-td">
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                {tab === 'invoices' &&
                  c.invoices.map((i) => (
                    <tr key={i._id}>
                      <td className="table-td">
                        <Link to={`/app/invoices/${i._id}`} className="link">
                          {i.invoiceNumber}
                        </Link>
                      </td>
                      <td className="table-td">{date(i.issueDate)}</td>
                      <td className="table-td text-right tabular-nums">{money(i.total)}</td>
                      <td className="table-td text-right tabular-nums">{money(i.balance)}</td>
                      <td className="table-td">
                        <StatusBadge status={i.status} />
                      </td>
                    </tr>
                  ))}
                {tab === 'custom' &&
                  c.customRequests.map((r) => (
                    <tr key={r._id}>
                      <td className="table-td">
                        <Link to={`/app/custom-orders/${r._id}`} className="link">
                          {r.requestNumber}
                        </Link>
                      </td>
                      <td className="table-td">{r.furnitureType}</td>
                      <td className="table-td">{date(r.createdAt)}</td>
                      <td className="table-td text-right">{r.quotedPrice ? money(r.quotedPrice) : '—'}</td>
                      <td className="table-td">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!{ orders: c.orders, payments: c.payments, invoices: c.invoices, custom: c.customRequests }[tab].length && <p className="p-6 text-center text-sm text-stone-500">Nothing to show.</p>}
          </div>
          <CustomerFormModal open={editing} onClose={() => setEditing(false)} customer={c} />
        </div>
      )}
    </QueryState>
  );
}
