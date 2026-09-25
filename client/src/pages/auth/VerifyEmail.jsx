import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/States';
import { authApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const { user, refreshProfile } = useAuth();
  const [state, setState] = useState({ status: 'loading' });
  const started = useRef(false);

  useEffect(() => {
    // Tokens are single use, so guard against React StrictMode's double effect.
    if (started.current) return;
    started.current = true;
    authApi
      .verifyEmail(params.get('token') || '')
      .then(async (res) => {
        setState({ status: 'ok', message: res.message });
        if (user) await refreshProfile().catch(() => {});
      })
      .catch((err) => setState({ status: 'error', message: errorMessage(err) }));
  }, [params, user, refreshProfile]);

  if (state.status === 'loading') return <PageLoader label="Confirming your email…" />;
  const ok = state.status === 'ok';
  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-card">
        {ok ? <CheckCircle2 className="mx-auto h-12 w-12 text-sage-600" /> : <XCircle className="mx-auto h-12 w-12 text-red-500" />}
        <h1 className="mt-4 font-display text-2xl font-semibold text-walnut-950">{ok ? 'Email confirmed' : 'Link not valid'}</h1>
        <p className="mt-2 text-sm text-stone-600">{state.message}</p>
        <Button to={user ? '/account' : '/login'} className="mt-6">
          {user ? 'Go to my account' : 'Log in'}
        </Button>
      </div>
    </div>
  );
}
