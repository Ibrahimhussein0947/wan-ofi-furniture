import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, ClipboardList, Factory, Hammer, PlayCircle, Truck } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { Card, ProgressBar, StatCard } from '../../../components/ui/misc';
import { StatusBadge, Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/States';
import { useAuth } from '../../../context/AuthContext';
import { tasksApi } from '../../../api/endpoints';
import useMutationToast from '../../../hooks/useMutationToast';
import { date, daysUntil, label, timeAgo } from '../../../utils/format';

function DueLabel({ value }) {
  const days = daysUntil(value);
  if (days === null) return null;
  const text = days < 0 ? `${-days} day(s) overdue` : days === 0 ? 'Due today' : `Due in ${days} day(s)`;
  return <span className={clsx('text-sm font-medium', days < 0 ? 'text-red-600' : days <= 2 ? 'text-amber-700' : 'text-stone-500')}>{text}</span>;
}

export default function WorkerDashboard({ data }) {
  const { user, can } = useAuth();
  const k = data.kpis;
  const updateTask = useMutationToast(({ id, status }) => tasksApi.update(id, { status }), { success: 'Task updated', invalidate: ['dashboard', 'tasks'] });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Hi {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-stone-500">{label(user?.workerRole)} · your work for today</p>
        </div>
        {can('production:manage') && (
          <Button to="/app/production" icon={Factory} size="lg">
            Production board
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="My jobs" value={k.assignedJobs} icon={Hammer} />
        <StatCard label="Due soon" value={k.dueSoon} icon={CalendarClock} tone="brass" />
        <StatCard label="Overdue" value={k.overdue} icon={AlertTriangle} tone={k.overdue ? 'red' : 'green'} />
        <StatCard label="Open tasks" value={k.openTasks} icon={ClipboardList} tone="blue" to="/app/tasks" />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Assigned jobs</h2>
        {!data.jobs.length ? (
          <div className="card">
            <EmptyState icon={CheckCircle2} title="No active jobs" message="New assignments will appear here and you'll get a notification." />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.jobs.map((j) => (
              <Link key={j._id} to={`/app/production/${j._id}`} className="card block p-5 transition hover:shadow-lift active:bg-walnut-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-stone-500">
                      {j.jobNumber} · {j.order?.orderNumber}
                    </p>
                    <p className="mt-0.5 text-lg font-semibold leading-snug text-stone-900">{j.title}</p>
                  </div>
                  <ChevronRight className="h-6 w-6 shrink-0 text-stone-400" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={j.stage} />
                  {j.priority !== 'NORMAL' && <StatusBadge status={j.priority} />}
                  {j.openProblems > 0 && <Badge tone="red">{j.openProblems} open problem(s)</Badge>}
                </div>
                <ProgressBar value={j.progress} showLabel className="mt-4" />
                <div className="mt-3">
                  <DueLabel value={j.expectedCompletionDate} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="My tasks" padded={false} actions={<Link to="/app/tasks" className="link text-sm">All tasks</Link>}>
          {!data.tasks.length ? (
            <p className="p-5 text-sm text-stone-500">No open tasks.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.tasks.map((t) => (
                <li key={t._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-stone-500">
                      {t.job?.jobNumber} · {t.dueDate ? `due ${date(t.dueDate)}` : 'no due date'}
                    </p>
                  </div>
                  {t.status === 'TODO' ? (
                    <Button size="md" variant="secondary" icon={PlayCircle} onClick={() => updateTask.mutate({ id: t._id, status: 'IN_PROGRESS' })}>
                      Start
                    </Button>
                  ) : (
                    <Button size="md" variant="success" icon={CheckCircle2} onClick={() => updateTask.mutate({ id: t._id, status: 'DONE' })}>
                      Done
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Materials still needed" padded={false}>
          {!data.materialNeeds.length ? (
            <p className="p-5 text-sm text-stone-500">All required materials have been issued for your jobs.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.materialNeeds.map((m, i) => (
                <li key={i} className="flex justify-between px-5 py-2.5 text-sm">
                  <span>
                    {m.name} <span className="text-xs text-stone-500">({m.job})</span>
                  </span>
                  <span className="font-medium">
                    {m.outstanding} {m.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {data.deliveries.length > 0 && (
        <Card title="My deliveries" padded={false}>
          <ul className="divide-y divide-stone-100">
            {data.deliveries.map((d) => (
              <li key={d._id}>
                <Link to={`/app/deliveries/${d._id}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-stone-50">
                  <span className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-walnut-600" />
                    <span>
                      <span className="block font-medium">
                        {d.order?.orderNumber} · {d.customer?.name}
                      </span>
                      <span className="text-sm text-stone-500">{d.scheduledDate ? date(d.scheduledDate) : 'Date to be set'}</span>
                    </span>
                  </span>
                  <StatusBadge status={d.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Recent notifications" padded={false} actions={<Link to="/app/notifications" className="link text-sm">All</Link>}>
        <ul className="divide-y divide-stone-100">
          {!data.notifications.length && <li className="p-5 text-sm text-stone-500">Nothing new.</li>}
          {data.notifications.map((n) => (
            <li key={n._id} className="px-5 py-3">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-stone-500">
                {n.message} · {timeAgo(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
