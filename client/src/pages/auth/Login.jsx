import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { useAuth, homePathFor } from '../../context/AuthContext';
import { errorMessage } from '../../api/client';
import { useT } from '../../i18n/LanguageContext';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export default function Login() {
  const t = useT();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    setError('');
    try {
      const user = await login(values);
      const from = location.state?.from?.pathname;
      const allowed = from && (user.role === 'CUSTOMER' ? !from.startsWith('/app') : !from.startsWith('/account') && from !== '/checkout');
      navigate(allowed ? from : homePathFor(user), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-card">
          <h1 className="font-display text-3xl font-semibold text-walnut-950">{t('Welcome back')}</h1>
          <p className="mt-1 text-sm text-stone-600">{t('Log in to your Wan Ofi account.')}</p>
          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            <Input label={t('Email')} type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
            <div className="relative">
              <Input label={t('Password')} type={show ? 'text' : 'password'} autoComplete="current-password" error={errors.password?.message} className="pr-10" {...register('password')} />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-8 p-1 text-stone-400 hover:text-stone-600" aria-label={show ? t('Hide password') : t('Show password')}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="-mt-1 text-right">
              <Link to="/forgot-password" className="text-sm text-walnut-700 hover:underline">
                {t('Forgot password?')}
              </Link>
            </div>
            <Button type="submit" block size="lg" loading={isSubmitting} icon={LogIn}>
              {t('Log in')}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-stone-600">
            {t('New here?')}{' '}
            <Link to="/register" state={location.state} className="link">
              {t('Create an account')}
            </Link>
          </p>
        </div>
        {import.meta.env.DEV && (
          <p className="mt-4 text-center text-xs text-stone-500">
            Development: owner@wanofi.com, accountant@wanofi.com, supervisor@wanofi.com, carpenter@wanofi.com, amina@example.com — password <code>Password123!</code>
          </p>
        )}
      </div>
    </div>
  );
}
