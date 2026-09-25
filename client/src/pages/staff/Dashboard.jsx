import { useQuery } from '@tanstack/react-query';
import { QueryState } from '../../components/ui/States';
import { dashboardApi } from '../../api/endpoints';
import OwnerDashboard from './dashboards/OwnerDashboard';
import AccountantDashboard from './dashboards/AccountantDashboard';
import WorkerDashboard from './dashboards/WorkerDashboard';

export default function Dashboard() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get, refetchInterval: 120000 });
  return (
    <QueryState query={query}>
      {(data) => {
        if (data.role === 'OWNER') return <OwnerDashboard data={data} />;
        if (data.role === 'ACCOUNTANT') return <AccountantDashboard data={data} />;
        return <WorkerDashboard data={data} />;
      }}
    </QueryState>
  );
}
