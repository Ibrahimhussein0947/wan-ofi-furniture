import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MessageCircle, Send } from 'lucide-react';
import Button from './ui/Button';
import { Checkbox } from './ui/Field';
import { authApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import { useT } from '../i18n/LanguageContext';

/** Telegram linking and WhatsApp opt-in, shown under the profile's notification settings. */
export default function ChatChannels({ phone }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ['chat-channels'], queryFn: authApi.chatChannels });
  const c = query.data;
  if (!c) return null;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['chat-channels'] });

  const run = async (fn, success) => {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const connect = () =>
    run(async () => {
      const { url } = await authApi.telegramLink();
      if (url) window.open(url, '_blank', 'noopener');
      toast(t('Tap "Start" in Telegram to finish connecting.'), { icon: '💬' });
    });

  return (
    <div className="mt-4 space-y-4 border-t border-stone-100 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <Send className="mt-0.5 h-5 w-5 text-sky-600" aria-hidden />
          <div>
            <p className="text-sm font-medium text-stone-900">{t('Telegram')}</p>
            <p className="text-xs text-stone-500">
              {!c.telegram.available
                ? t('Not set up by the shop yet.')
                : c.telegram.connected
                  ? t('Connected — updates arrive in Telegram.')
                  : t('Get updates as Telegram messages.')}
            </p>
          </div>
        </div>
        {c.telegram.available &&
          (c.telegram.connected ? (
            <Button size="sm" variant="ghost" loading={busy} onClick={() => run(authApi.telegramDisconnect, t('Telegram disconnected'))}>
              {t('Disconnect')}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" icon={Send} loading={busy} onClick={connect}>
              {t('Connect Telegram')}
            </Button>
          ))}
      </div>
      {c.telegram.connected && (
        <Checkbox
          label={t('Send me updates on Telegram')}
          checked={c.telegram.enabled}
          disabled={busy}
          onChange={(e) => run(() => authApi.updateProfile({ notificationPrefs: { telegram: e.target.checked } }), t('Preferences saved'))}
        />
      )}

      <div className="flex gap-3">
        <MessageCircle className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden />
        <div className="flex-1">
          <p className="text-sm font-medium text-stone-900">{t('WhatsApp')}</p>
          {!c.whatsapp.available ? (
            <p className="text-xs text-stone-500">{t('Not set up by the shop yet.')}</p>
          ) : !phone ? (
            <p className="text-xs text-stone-500">{t('Add a phone number above to get WhatsApp updates.')}</p>
          ) : (
            <Checkbox
              label={t('Send me updates on WhatsApp ({phone})', { phone })}
              checked={c.whatsapp.enabled}
              disabled={busy}
              onChange={(e) => run(() => authApi.updateProfile({ notificationPrefs: { whatsapp: e.target.checked } }), t('Preferences saved'))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
