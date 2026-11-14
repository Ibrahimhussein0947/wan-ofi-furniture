import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Activity, Database, Globe, HardDrive, Power, ShoppingBag, UserCog, Users } from 'lucide-react';
import { QueryState } from '../../../components/ui/States';
import { Card, PageHeader, StatCard } from '../../../components/ui/misc';
import { Badge } from '../../../components/ui/Badge';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import useMutationToast from '../../../hooks/useMutationToast';
import { superAdminApi } from '../../../api/endpoints';
import { useT } from '../../../i18n/LanguageContext';

const AREAS = [
  { key: 'storefront', icon: Globe, title: 'Public website', text: 'Visitors who are not signed in: the shop, product pages and sign-up.' },
  { key: 'customers', icon: Users, title: 'Customer accounts', text: 'Signed-in customers: their orders, payments, wishlist and messages.' },
  { key: 'staff', icon: UserCog, title: 'Staff app', text: 'Owner, accountants and workers: the whole back office.' },
];

function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-sage-600' : 'bg-stone-300')}
    >
      <span className={clsx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

const uptime = (s) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

export default function SystemControl() {
  const t = useT();
  const query = useQuery({ queryKey: ['superadmin'], queryFn: superAdminApi.overview, refetchInterval: 10000 });
  const [confirm, setConfirm] = useState(null); // { key, value }
  const update = useMutationToast((body) => superAdminApi.setSystems(body), { success: 'Systems updated', invalidate: ['superadmin'], onSuccess: () => setConfirm(null) });

  return (
    <QueryState query={query}>
      {({ systems, health, counts }) => {
        const online = systems.master;
        const ask = (key, value) => (value ? update.mutate({ [key]: true }) : setConfirm({ key, value }));
        return (
          <div className="space-y-6">
            <PageHeader title={t('System control')} subtitle={t('See how the system is running and switch parts of it on or off.')} />

            <div className={clsx('flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5', online ? 'border-sage-200 bg-sage-50' : 'border-red-200 bg-red-50')}>
              <div className="flex items-center gap-4">
                <span className={clsx('flex h-12 w-12 items-center justify-center rounded-full', online ? 'bg-sage-600 text-white' : 'bg-red-600 text-white')}>
                  <Power className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-stone-900">{online ? t('Everything is on') : t('Everything is switched off')}</p>
                  <p className="text-sm text-stone-600">
                    {online ? t('Switch off to stop all other users. They will only see "Something went wrong".') : t('Other users currently see "Something went wrong". You can still use the system.')}
                  </p>
                </div>
              </div>
              <Switch checked={online} onChange={(v) => ask('master', v)} label={t('Master switch')} disabled={update.isPending} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {AREAS.map(({ key, icon: Icon, title, text }) => (
                <Card key={key}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-walnut-100 text-walnut-800">
                      <Icon className="h-5 w-5" />
                    </span>
                    <Switch checked={systems[key]} onChange={(v) => ask(key, v)} label={t(title)} disabled={update.isPending || !online} />
                  </div>
                  <h3 className="mt-3 font-semibold text-stone-900">{t(title)}</h3>
                  <p className="mt-1 text-sm text-stone-600">{t(text)}</p>
                  <Badge tone={online && systems[key] ? 'green' : 'red'} className="mt-3" dot>
                    {online && systems[key] ? t('On') : t('Off')}
                  </Badge>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label={t('API')} value={health.api === 'ok' ? t('Running') : t('Down')} icon={Activity} tone={health.api === 'ok' ? 'green' : 'red'} hint={`${t('Up for')} ${uptime(health.uptimeSeconds)}`} />
              <StatCard label={t('Database')} value={health.database === 'connected' ? t('Connected') : health.database} icon={Database} tone={health.database === 'connected' ? 'green' : 'red'} />
              <StatCard label={t('Memory')} value={`${health.memoryMb} MB`} icon={HardDrive} hint={`${t('Load')} ${health.cpuLoad} · Node ${health.node}`} />
              <StatCard label={t('Environment')} value={health.environment} icon={ShoppingBag} hint={new Date(health.serverTime).toLocaleString()} />
            </div>

            <Card title={t('Data in the system')}>
              <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Orders', counts.orders],
                  ['Products', counts.products],
                  ['Customers', counts.customers],
                  ['Payments', counts.payments],
                ].map(([name, n]) => (
                  <div key={name}>
                    <dt className="text-stone-500">{t(name)}</dt>
                    <dd className="text-xl font-semibold tabular-nums text-stone-900">{n}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 border-t border-stone-100 pt-4 text-sm text-stone-600">
                {t('Accounts')}: {Object.entries(counts.usersByRole).map(([r, n]) => `${r.replace('_', ' ').toLowerCase()} ${n}`).join(' · ')}
              </p>
            </Card>

            <ConfirmDialog
              open={Boolean(confirm)}
              onClose={() => setConfirm(null)}
              title={confirm?.key === 'master' ? t('Switch everything off?') : t('Switch this part off?')}
              message={confirm?.key === 'master' ? t('Everyone except you will see "Something went wrong" until you switch it back on.') : t('Its users will see "Something went wrong" until you switch it back on.')}
              confirmLabel={t('Switch off')}
              loading={update.isPending}
              onConfirm={() => update.mutate({ [confirm.key]: false })}
            />
          </div>
        );
      }}
    </QueryState>
  );
}
