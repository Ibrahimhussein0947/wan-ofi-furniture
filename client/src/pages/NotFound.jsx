import { Compass } from 'lucide-react';
import Button from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';

export default function NotFound({ inApp }) {
  return (
    <div className="container-page py-16">
      <EmptyState icon={Compass} title="Page not found" message="The page you're looking for doesn't exist or was moved." action={<Button to={inApp ? '/app' : '/'}>{inApp ? 'Back to dashboard' : 'Go home'}</Button>} />
    </div>
  );
}
