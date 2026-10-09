import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import DataTable from '../../../components/ui/DataTable';
import ExportMenu from '../../../components/ExportMenu';
import { Card, FilterBar, PageHeader } from '../../../components/ui/misc';
import { Input, Select } from '../../../components/ui/Field';
import { QueryState } from '../../../components/ui/States';
import { BarsChart, DonutChart, TrendChart } from '../../../components/charts/Charts';
import { customersApi, productsApi, reportsApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import useListParams from '../../../hooks/useListParams';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, TRANSACTION_TYPES } from '../../../utils/constants';
import { date, label, localDate } from '../../../utils/format';
import { REPORTS } from './reportConfigs';
import BranchSelect from '../../../components/BranchSelect';
import { useT } from '../../../i18n/LanguageContext';

function ReportChart({ config, data }) {
  const c = config.chart;
  if (!c) return null;
  if (c.type === 'donut') {
    const rows = c.data(data);
    return rows.length ? <DonutChart data={rows} nameKey={c.name} valueKey={c.value} height={200} /> : null;
  }
  const rows = (config.rows(data) || []).slice(0, c.limit || 100);
  if (!rows.length) return null;
  if (c.type === 'area') return <TrendChart data={rows} xKey={c.x} series={c.series} height={260} />;
  return <BarsChart data={rows} xKey={c.x} series={c.series} horizontal={c.type === 'hbar'} height={c.type === 'hbar' ? 320 : 260} formatX={(v) => v} />;
}

export default function Reports() {
  const t = useT();
  const { can } = useAuth();
  const available = REPORTS.filter((r) => can(r.perm));
  const [params, set] = useListParams();
  const config = available.find((r) => r.key === params.report) || available[0];
  const { report, page, limit, ...filters } = params;

  const query = useQuery({ queryKey: ['report', config?.key, filters], queryFn: () => reportsApi.run(config.key, filters), enabled: Boolean(config) });
  const customers = useQuery({ queryKey: ['customers', 'report-filter'], queryFn: () => customersApi.list({ limit: 100 }).then((r) => r.items), enabled: Boolean(config?.filters.includes('customer')) && can('customers:read') });
  const products = useQuery({ queryKey: ['products', 'report-filter'], queryFn: () => productsApi.list({ limit: 100 }).then((r) => r.items), enabled: Boolean(config?.filters.includes('product')) });

  const groups = useMemo(() => [...new Set(available.map((r) => r.group))], [available]);
  if (!config) return null;
  const has = (f) => config.filters.includes(f);
  const columns = config.key === 'sales' && filters.product ? config.productColumns : config.columns;

  return (
    <div>
      <PageHeader title={t('Reports')} subtitle={t('Filter, then export to CSV/Excel or PDF, or print.')} />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="no-print space-y-4" aria-label={t('Reports')}>
          {groups.map((g) => (
            <div key={g}>
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{g}</p>
              {available
                .filter((r) => r.group === g)
                .map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => set({ report: r.key, product: '', customer: '', category: '', method: '', type: '', period: '', branch: '' })}
                    className={clsx('block w-full rounded-lg px-3 py-2 text-left text-sm', r.key === config.key ? 'bg-walnut-800 font-medium text-white' : 'text-stone-700 hover:bg-stone-100')}
                  >
                    {r.title}
                  </button>
                ))}
            </div>
          ))}
        </nav>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">{config.title}</h2>
            {query.data && (
              <ExportMenu
                filename={`${config.key}-${localDate()}`}
                title={config.title}
                subtitle={[filters.from && `From ${date(filters.from)}`, filters.to && `to ${date(filters.to)}`].filter(Boolean).join(' ')}
                columns={config.sections ? config.sections(query.data)[0].columns : columns}
                rows={config.sections ? config.sections(query.data)[0].rows : config.rows(query.data)}
                summary={config.summary(query.data)}
              />
            )}
          </div>

          <FilterBar className="no-print">
            {has('period') && (
              <Select label={t('Group by')} value={filters.period || (config.key === 'profit-loss' ? 'monthly' : 'daily')} onChange={(e) => set({ period: e.target.value })} options={['daily', 'weekly', 'monthly', 'annual'].map((p) => ({ value: p, label: t(label(p)) }))} containerClassName="sm:w-36" />
            )}
            {has('dates') || has('period') ? (
              <>
                <Input label={t('From')} type="date" value={filters.from || ''} onChange={(e) => set({ from: e.target.value })} containerClassName="sm:w-40" />
                <Input label="To" type="date" value={filters.to || ''} onChange={(e) => set({ to: e.target.value })} containerClassName="sm:w-40" />
              </>
            ) : null}
            {has('customer') && customers.data && <Select label={t('Customer')} value={filters.customer || ''} onChange={(e) => set({ customer: e.target.value })} options={customers.data.map((c) => ({ value: c._id, label: c.name }))} placeholder={t('All customers')} containerClassName="sm:w-48" />}
            {has('product') && <Select label={t('Product')} value={filters.product || ''} onChange={(e) => set({ product: e.target.value })} options={(products.data || []).map((p) => ({ value: p._id, label: p.name }))} placeholder={t('All products')} containerClassName="sm:w-52" />}
            {has('branch') && <BranchSelect label={t('Branch')} value={filters.branch || ''} onChange={(e) => set({ branch: e.target.value })} containerClassName="sm:w-48" />}
            {has('method') && <Select label={t('Payment method')} value={filters.method || ''} onChange={(e) => set({ method: e.target.value })} options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(label(m)) }))} placeholder={t('All methods')} containerClassName="sm:w-44" />}
            {has('expenseCategory') && <Select label={t('Category')} value={filters.category || ''} onChange={(e) => set({ category: e.target.value })} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(label(c)) }))} placeholder={t('All categories')} containerClassName="sm:w-44" />}
            {has('paymentCategory') && <Select label={t('Type')} value={filters.category || ''} onChange={(e) => set({ category: e.target.value })} options={['CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'WORKER_PAYMENT', 'REFUND'].map((c) => ({ value: c, label: t(label(c)) }))} placeholder={t('All types')} containerClassName="sm:w-48" />}
            {has('transactionType') && <Select label={t('Transaction type')} value={filters.type || ''} onChange={(e) => set({ type: e.target.value })} options={TRANSACTION_TYPES.map((type) => ({ value: type, label: t(label(type)) }))} placeholder={t('All types')} containerClassName="sm:w-48" />}
          </FilterBar>

          <QueryState query={query}>
            {(data) => (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {config.summary(data).map(([k, v]) => (
                    <div key={k} className="card p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{k}</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{v}</p>
                    </div>
                  ))}
                </div>
                {config.chart && (
                  <Card>
                    <ReportChart config={config} data={data} />
                  </Card>
                )}
                {config.sections ? (
                  config.sections(data).map((s) => (
                    <div key={s.title}>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold">{s.title}</h3>
                        <ExportMenu filename={`${config.key}-${s.title.toLowerCase().replace(/\W+/g, '-')}`} title={`${config.title} — ${s.title}`} columns={s.columns} rows={s.rows} />
                      </div>
                      <DataTable dense columns={s.columns} rows={s.rows} rowKey={(r) => r._id || r.customerId || r.workerId || r.materialId || JSON.stringify(r).slice(0, 80)} />
                    </div>
                  ))
                ) : (
                  <DataTable dense columns={columns} rows={config.rows(data)} rowKey={(r) => r._id || r.period || r.product || r.customerId || r.supplierId || r.transactionNumber || r.paymentNumber || r.expenseNumber} />
                )}
              </div>
            )}
          </QueryState>
        </div>
      </div>
    </div>
  );
}
