import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Clock, Mail, MapPin, Phone, Send } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Field';
import { publicApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { usePublicSettings } from '../../components/SettingsLoader';

const schema = z.object({
  name: z.string().trim().min(2, 'Please enter your name'),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().trim().min(10, 'Message is too short'),
});

export default function Contact() {
  const { data: company } = usePublicSettings();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    try {
      const res = await publicApi.contact(values);
      toast.success(res.message);
      reset();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="container-page py-12">
      <h1 className="font-display text-4xl font-semibold text-walnut-950">Contact us</h1>
      <p className="mt-2 text-stone-600">Questions about an order, a custom piece or a visit? We're happy to help.</p>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4 p-6" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Your name" required error={errors.name?.message} {...register('name')} />
            <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />
            <Input label="Phone" type="tel" {...register('phone')} />
            <Input label="Subject" {...register('subject')} />
          </div>
          <Textarea label="Message" rows={6} required error={errors.message?.message} {...register('message')} />
          <Button type="submit" icon={Send} loading={isSubmitting}>
            Send message
          </Button>
        </form>
        <aside className="space-y-4 rounded-2xl bg-walnut-900 p-6 text-walnut-100">
          {[
            [MapPin, 'Showroom & workshop', company?.companyAddress],
            [Phone, 'Phone', company?.companyPhone],
            [Mail, 'Email', company?.companyEmail],
            [Clock, 'Opening hours', 'Mon–Sat, 8:00 – 18:00'],
          ].map(([Icon, t, v]) => (
            <div key={t} className="flex gap-3">
              <Icon className="mt-0.5 h-5 w-5 text-brass-300" />
              <div>
                <p className="text-sm font-semibold text-white">{t}</p>
                <p className="text-sm">{v || '—'}</p>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
