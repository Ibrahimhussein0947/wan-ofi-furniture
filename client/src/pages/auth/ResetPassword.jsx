import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, KeyRound } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { EmptyState } from '../../components/ui/States';
import { authApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { useT } from '../../i18n/LanguageContext';

export const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Za-z]/, 'Include a letter')
      .regex(/\d/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export default function ResetPassword() {
  const t = useT();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetSchema) });

  if (!/^[a-f\d]{64}$/.test(token)) {
    return <EmptyState title={t('Invalid reset link')} message={t('This link is incomplete. Request a new one.')} action={<Button to="/forgot-password">{t('Request a new link')}</Button>} />;
  }

  const onSubmit = async ({ password }) => {
    setError('');
    try {
      await authApi.resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card">
        {done ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-sage-600" />
            <h1 className="mt-4 font-display text-2xl font-semibold text-walnut-950">{t('Password updated')}</h1>
            <p className="mt-2 text-sm text-stone-600">{t('For your security, every device was signed out. Log in with your new password.')}</p>
            <Button to="/login" className="mt-6">
              {t('Log in')}
            </Button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl font-semibold text-walnut-950">{t('Choose a new password')}</h1>
            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}{' '}
                <Link to="/forgot-password" className="underline">
                  {t('Request a new link')}
                </Link>
              </p>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <Input label={t('New password')} type="password" autoComplete="new-password" hint={t('8+ characters with a letter and a number')} error={errors.password?.message} {...register('password')} />
              <Input label={t('Confirm new password')} type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
              <Button type="submit" block size="lg" icon={KeyRound} loading={isSubmitting}>
                {t('Update password')}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
