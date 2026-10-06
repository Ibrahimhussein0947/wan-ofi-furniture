import { Compass } from 'lucide-react';
import Button from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';
import { useT } from '../i18n/LanguageContext';

export default function NotFound({ inApp }) {
  const t = useT();
  return (
    <div className="container-page py-16">
      <EmptyState icon={Compass} title={t('Page not found')} message={t("The page you're looking for doesn't exist or was moved.")} action={<Button to={inApp ? '/app' : '/'}>{inApp ? t('Back to dashboard') : t('Go home')}</Button>} />
    </div>
  );
}
