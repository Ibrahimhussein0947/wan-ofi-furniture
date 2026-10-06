import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { useAuth } from '../../context/AuthContext';
import { errorMessage, fieldErrors } from '../../api/client';
import { useT } from '../../i18n/LanguageContext';

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name'),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z
      .string()
      .trim()
      .regex(/^([+\d][\d\s-]{6,20})?$/, 'Enter a valid phone number')
      .optional(),
    city: z.string().optional(),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Za-z]/, 'Include a letter')
      .regex(/\d/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export default function Register() {
  const t = useT();
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema) });

  const onSubmit = async ({ confirm, city, ...values }) => {
    setError('');
    try {
      await signUp({ ...values, phone: values.phone || undefined, address: city ? { city, country: 'Ethiopia' } : undefined });
      navigate(location.state?.from?.pathname || '/account', { replace: true });
    } catch (err) {
      Object.entries(fieldErrors(err)).forEach(([field, message]) => setFieldError(field, { message }));
      setError(errorMessage(err));
    }
  };

  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-card">
        <h1 className="font-display text-3xl font-semibold text-walnut-950">{t('Create your account')}</h1>
        <p className="mt-1 text-sm text-stone-600">{t('Order furniture, request custom pieces and track production.')}</p>
        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-4 sm:grid-cols-2" noValidate>
          <Input label={t('Full name')} autoComplete="name" required containerClassName="sm:col-span-2" error={errors.name?.message} {...register('name')} />
          <Input label={t('Email')} type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
          <Input label={t('Phone')} type="tel" autoComplete="tel" placeholder="+251 9…" error={errors.phone?.message} {...register('phone')} />
          <Input label={t('City')} autoComplete="address-level2" containerClassName="sm:col-span-2" {...register('city')} />
          <Input label={t('Password')} type="password" autoComplete="new-password" required error={errors.password?.message} hint={t('8+ characters with a letter and a number')} {...register('password')} />
          <Input label={t('Confirm password')} type="password" autoComplete="new-password" required error={errors.confirm?.message} {...register('confirm')} />
          <Button type="submit" block size="lg" loading={isSubmitting} icon={UserPlus} className="sm:col-span-2">
            {t('Create account')}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-stone-600">
          {t('Already have an account?')}{' '}
          <Link to="/login" state={location.state} className="link">
            {t('Log in')}
          </Link>
        </p>
      </div>
    </div>
  );
}
