import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { Card, PageHeader, DetailList } from '../../components/ui/misc';
import { Checkbox, Input } from '../../components/ui/Field';
import { authApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { dateTime, label } from '../../utils/format';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Za-z]/, 'Include a letter')
      .regex(/\d/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export default function Profile() {
  const { user, customer, refreshProfile, applySession } = useAuth();
  const profile = useForm({
    values: {
      name: user?.name || '',
      phone: user?.phone || '',
      street: customer?.address?.street || '',
      city: customer?.address?.city || '',
      company: customer?.company || '',
    },
  });
  const pwd = useForm({ resolver: zodResolver(passwordSchema) });

  const saveProfile = async ({ street, city, company, ...values }) => {
    try {
      await authApi.updateProfile({
        ...values,
        phone: values.phone || undefined,
        ...(customer && { address: { ...customer.address, street, city }, company }),
      });
      await refreshProfile();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    try {
      const session = await authApi.changePassword({ currentPassword, newPassword });
      await applySession(session);
      pwd.reset();
      toast.success('Password changed. Other devices have been signed out.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="My profile" subtitle={user?.email} />
      <Card title="Account">
        <DetailList
          items={[
            { label: 'Role', value: label(user?.workerRole || user?.role) },
            { label: 'Email', value: user?.email },
            { label: 'Last login', value: dateTime(user?.lastLoginAt) },
            { label: 'Email status', value: user?.emailVerified ? 'Confirmed' : 'Not confirmed yet' },
            customer && { label: 'Customer code', value: customer.customerCode },
          ]}
        />
      </Card>
      <Card title="Personal details">
        <form onSubmit={profile.handleSubmit(saveProfile)} className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" required {...profile.register('name', { required: true, minLength: 2 })} />
          <Input label="Phone" type="tel" {...profile.register('phone')} />
          {customer && (
            <>
              <Input label="Street / area" {...profile.register('street')} />
              <Input label="City" {...profile.register('city')} />
              <Input label="Company (optional)" containerClassName="sm:col-span-2" {...profile.register('company')} />
            </>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" loading={profile.formState.isSubmitting}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>
      <Card title="Notifications" subtitle="Everything always appears in the app. Choose which updates also reach you outside it.">
        <div className="space-y-3">
          {[
            ['email', `Email me important updates (${user?.email})`],
            ['sms', `Text me important updates${user?.phone ? ` (${user.phone})` : ' — add a phone number above'}`],
          ].map(([key, text]) => (
            <Checkbox
              key={key}
              label={text}
              checked={user?.notificationPrefs?.[key] !== false}
              onChange={async (e) => {
                try {
                  await authApi.updateProfile({ notificationPrefs: { [key]: e.target.checked } });
                  await refreshProfile();
                  toast.success('Preferences saved');
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            />
          ))}
        </div>
      </Card>
      <Card title="Change password">
        <form onSubmit={pwd.handleSubmit(changePassword)} className="grid gap-4 sm:grid-cols-3">
          <Input label="Current password" type="password" autoComplete="current-password" error={pwd.formState.errors.currentPassword?.message} {...pwd.register('currentPassword')} />
          <Input label="New password" type="password" autoComplete="new-password" error={pwd.formState.errors.newPassword?.message} {...pwd.register('newPassword')} />
          <Input label="Confirm new password" type="password" autoComplete="new-password" error={pwd.formState.errors.confirm?.message} {...pwd.register('confirm')} />
          <div className="sm:col-span-3">
            <Button type="submit" variant="secondary" loading={pwd.formState.isSubmitting}>
              Update password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
