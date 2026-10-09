import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Clock, Landmark, Mail, MapPin, Phone, Send } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Field';
import { publicApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { usePublicSettings } from '../../components/SettingsLoader';
import SocialIcon from '../../components/SocialIcon';
import BankAccounts from '../../components/BankAccounts';
import { socialLinks } from '../../utils/social';
import { useT } from '../../i18n/LanguageContext';
import usePageMeta from '../../hooks/usePageMeta';

const schema = z.object({
  name: z.string().trim().min(2, 'Please enter your name'),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().trim().min(10, 'Message is too short'),
});

export default function Contact() {
  const t = useT();
  usePageMeta({ title: t('Contact us'), description: t("Questions about an order, a custom piece or a visit? We're happy to help.") });
  const { data: company } = usePublicSettings();
  const hasAccounts = (company?.bankAccounts || []).length > 0;
  const { hash } = useLocation();

  // The footer links to /contact#pay; the section only exists once settings have loaded.
  useEffect(() => {
    if (hash !== '#pay' || !hasAccounts) return undefined;
    const timer = setTimeout(() => document.getElementById('pay')?.scrollIntoView());
    return () => clearTimeout(timer);
  }, [hash, hasAccounts]);
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
      <h1 className="font-display text-4xl font-semibold text-walnut-950">{t('Contact us')}</h1>
      <p className="mt-2 text-stone-600">{t("Questions about an order, a custom piece or a visit? We're happy to help.")}</p>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4 p-6" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('Your name')} required error={errors.name?.message} {...register('name')} />
            <Input label={t('Email')} type="email" required error={errors.email?.message} {...register('email')} />
            <Input label={t('Phone')} type="tel" {...register('phone')} />
            <Input label={t('Subject')} {...register('subject')} />
          </div>
          <Textarea label={t('Message')} rows={6} required error={errors.message?.message} {...register('message')} />
          <Button type="submit" icon={Send} loading={isSubmitting}>
            {t('Send message')}
          </Button>
        </form>
        <aside className="theme-static space-y-4 rounded-2xl bg-walnut-900 p-6 text-walnut-100">
          {[
            [MapPin, 'Showroom & workshop', company?.companyAddress],
            [Phone, 'Phone', company?.companyPhone],
            [Mail, 'Email', company?.companyEmail],
            [Clock, 'Opening hours', 'Mon–Sat, 8:00 – 18:00'],
          ].map(([Icon, label, v]) => (
            <div key={label} className="flex gap-3">
              <Icon className="mt-0.5 h-5 w-5 text-brass-300" />
              <div>
                <p className="text-sm font-semibold text-white">{t(label)}</p>
                <p className="text-sm">{label === 'Opening hours' ? t(v) : v || '—'}</p>
              </div>
            </div>
          ))}
          {socialLinks(company?.socialLinks).map((s) => (
            <a key={s.key} href={s.href} target="_blank" rel="noopener noreferrer" className="flex gap-3 hover:text-white">
              <SocialIcon name={s.key} className="mt-0.5 h-5 w-5 shrink-0 text-brass-300" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{s.label}</p>
                <p className="break-all text-sm">{s.text}</p>
              </div>
            </a>
          ))}
        </aside>
      </div>
      {hasAccounts && (
        <section id="pay" className="card mt-10 scroll-mt-24 p-6">
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-walnut-950">
            <Landmark className="h-6 w-6 text-brass-600" />
            {t('How to pay')}
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            {company?.paymentInstructions || t('Pay by bank transfer or mobile money into one of our accounts, then keep your receipt for the order.')}
          </p>
          <BankAccounts title={null} className="mt-4" listClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" />
        </section>
      )}
    </div>
  );
}
