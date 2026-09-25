import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money, label } from '../../utils/format';

// Warm, distinguishable series colours that match the walnut/brass theme.
export const SERIES = ['#744832', '#c48a22', '#5f7f63', '#3b82a0', '#a8734c', '#8b5cf6', '#d2b393', '#b45353'];

const axis = { fontSize: 11, fill: '#78716c' };
const compact = (v) => money(v, { compact: true, withCurrency: false });
const monthLabel = (p) => {
  if (!/^\d{4}-\d{2}$/.test(p)) return p;
  const [y, m] = p.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en', { month: 'short' });
};

function MoneyTooltip({ active, payload, label: l }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-stone-800">{l}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-stone-500">{p.name}:</span>
          <span className="font-medium tabular-nums">{p.unit === 'count' ? p.value : money(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function TrendChart({ data, xKey = 'period', series, height = 280, type = 'area', formatX = monthLabel }) {
  const Chart = type === 'line' ? LineChart : AreaChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color || SERIES[i]} stopOpacity={0.25} />
              <stop offset="95%" stopColor={s.color || SERIES[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tick={axis} tickFormatter={formatX} axisLine={false} tickLine={false} />
        <YAxis tick={axis} tickFormatter={compact} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<MoneyTooltip />} labelFormatter={formatX} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) =>
          type === 'line' ? (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color || SERIES[i]} strokeWidth={2} dot={false} />
          ) : (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color || SERIES[i]} strokeWidth={2} fill={`url(#grad-${s.key})`} />
          )
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

export function BarsChart({ data, xKey, series, height = 280, horizontal = false, count = false, formatX = monthLabel }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, left: horizontal ? 8 : 0, bottom: 0 }}>
        <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={axis} tickFormatter={count ? undefined : compact} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey={xKey} tick={axis} width={130} axisLine={false} tickLine={false} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={axis} tickFormatter={formatX} axisLine={false} tickLine={false} />
            <YAxis tick={axis} tickFormatter={count ? undefined : compact} axisLine={false} tickLine={false} width={48} allowDecimals={false} />
          </>
        )}
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#f5f5f4' }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} unit={count ? 'count' : undefined} fill={s.color || SERIES[i]} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, nameKey, valueKey, height = 260, count = false }) {
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-[220px] w-full sm:w-1/2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="58%" outerRadius="90%" paddingAngle={2} stroke="none">
              {data.map((_, i) => (
                <Cell key={i} fill={SERIES[i % SERIES.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => (count ? v : money(v))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1.5 text-sm sm:w-1/2">
        {data.map((d, i) => (
          <li key={d[nameKey]} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} />
              <span className="truncate text-stone-600">{label(d[nameKey])}</span>
            </span>
            <span className="tabular-nums text-stone-800">
              {count ? d[valueKey] : money(d[valueKey], { compact: true })}
              <span className="ml-1 text-xs text-stone-400">{total ? Math.round((d[valueKey] / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
