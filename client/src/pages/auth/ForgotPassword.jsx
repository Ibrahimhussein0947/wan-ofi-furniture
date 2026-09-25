import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck, Send } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { authApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';

const schema = z.object({ email: z.string().trim().email('Enter a valid email address') });

export default function ForgotPassword() {
  const [sent, setSent] = useState(null);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }) => {
    setError('');
    try {
      const res = await authApi.forgotPassword(email);
      setSent(res.message);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card">
        {sent ? (
          <div className="text-center">
            <MailCheck className="mx-auto h-12 w-12 text-sage-600" />
            <h1 className="mt-4 font-display text-2xl font-semibold text-walnut-950">Check your email</h1>
            <p className="mt-2 text-sm text-stone-600">{sent} The link expires in 1 hour.</p>
            <Button to="/login" variant="secondary" className="mt-6">
              Back to login
            </Button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl font-semibold text-walnut-950">Forgot your password?</h1>
            <p className="mt-1 text-sm text-stone-600">Enter your email and we'll send you a link to choose a new one.</p>
            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
              <Button type="submit" block size="lg" icon={Send} loading={isSubmitting}>
                Send reset link
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-stone-600">
              Remembered it?{' '}
              <Link to="/login" className="link">
                Log in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
