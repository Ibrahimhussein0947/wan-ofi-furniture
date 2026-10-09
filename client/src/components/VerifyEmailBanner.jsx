import { MailWarning } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';
import Button from './ui/Button';
import { useAuth } from '../context/AuthContext';
import { usePublicSettings } from './SettingsLoader';
import { authApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import { useT } from '../i18n/LanguageContext';

/** Reminds customers to confirm their email; ordering is blocked until they do. */
export default function VerifyEmailBanner() {
  const t = useT();
  const { user } = useAuth();
  const { data: settings } = usePublicSettings();
  const [sending, setSending] = useState(false);
  // Hidden when the shop doesn't require it (or can't send confirmation emails yet).
  if (!user || user.role !== 'CUSTOMER' || user.emailVerified !== false || !settings?.requireEmailVerification) return null;

  const resend = async () => {
    setSending(true);
    try {
      const res = await authApi.resendVerification();
      toast.success(res.message);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-b border-amber-200 bg-amber-50" role="status">
      <div className="container-page flex flex-col gap-2 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2">
          <MailWarning className="h-4 w-4 shrink-0" />
          Please confirm your email address ({user.email}) to place orders and make payments.
        </p>
        <Button size="sm" variant="secondary" loading={sending} onClick={resend}>
          {t('Resend confirmation link')}
        </Button>
      </div>
    </div>
  );
}
