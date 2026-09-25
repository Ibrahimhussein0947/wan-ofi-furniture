import { MailWarning } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';
import Button from './ui/Button';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/endpoints';
import { errorMessage } from '../api/client';

/** Reminds customers to confirm their email; ordering is blocked until they do. */
export default function VerifyEmailBanner() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  if (!user || user.role !== 'CUSTOMER' || user.emailVerified !== false) return null;

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
          Resend confirmation link
        </Button>
      </div>
    </div>
  );
}
