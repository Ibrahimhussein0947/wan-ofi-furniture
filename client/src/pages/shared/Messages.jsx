import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, MessageSquarePlus, Paperclip, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { Avatar } from '../../components/ui/misc';
import { EmptyState, Spinner } from '../../components/ui/States';
import { Select } from '../../components/ui/Field';
import { messagesApi } from '../../api/endpoints';
import { fileUrl } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import useMutationToast from '../../hooks/useMutationToast';
import { label, timeAgo, dateTime } from '../../utils/format';
import { useT } from '../../i18n/LanguageContext';

export default function Messages() {
  const t = useT();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const activeId = params.get('with');
  const [body, setBody] = useState('');
  const [composing, setComposing] = useState(false);
  const [files, setFiles] = useState([]);
  const fileRef = useRef(null);
  const bottomRef = useRef(null);
  const qc = useQueryClient();
  const isCustomer = user?.role === 'CUSTOMER';

  const conversations = useQuery({ queryKey: ['conversations'], queryFn: messagesApi.conversations, refetchInterval: 90000 });
  const contacts = useQuery({ queryKey: ['contacts'], queryFn: messagesApi.contacts, enabled: composing });
  const thread = useQuery({
    queryKey: ['thread', activeId],
    queryFn: () => messagesApi.thread(activeId),
    enabled: Boolean(activeId),
    // Live events refresh the thread instantly; this slow poll is a fallback.
    refetchInterval: 60000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (thread.data) qc.invalidateQueries({ queryKey: ['unread'] });
  }, [thread.data, qc]);

  const send = useMutationToast(({ payload, attachments }) => messagesApi.send(payload, attachments), {
    invalidate: ['conversations', 'thread'],
    onSuccess: (msg) => {
      setBody('');
      setFiles([]);
      setComposing(false);
      if (!activeId) setParams({ with: msg.receiver });
    },
  });

  const submit = (e) => {
    e.preventDefault();
    if (!body.trim() && !files.length) return;
    send.mutate({ payload: { receiver: activeId || undefined, body: body.trim() }, attachments: files });
  };

  const list = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-stone-100 p-4">
        <h1 className="text-lg font-semibold">{t('Messages')}</h1>
        <Button size="sm" variant="secondary" icon={MessageSquarePlus} onClick={() => setComposing(true)}>
          {t('New')}
        </Button>
      </div>
      {composing && (
        <div className="border-b border-stone-100 p-4">
          <Select
            label={t('Send to')}
            placeholder={contacts.isLoading ? 'Loading…' : 'Choose a person'}
            options={(contacts.data || []).map((c) => ({ value: c._id, label: `${c.name}${isCustomer ? '' : ` — ${t(label(c.workerRole || c.role))}`}` }))}
            onChange={(e) => {
              if (e.target.value) {
                setParams({ with: e.target.value });
                setComposing(false);
              }
            }}
          />
          {isCustomer && (
            <button type="button" className="mt-2 text-sm text-walnut-700 hover:underline" onClick={() => { setParams({}); setComposing(false); }}>
              {t('Or write to the Wan Ofi team')}
            </button>
          )}
        </div>
      )}
      <ul className="flex-1 divide-y divide-stone-100 overflow-y-auto">
        {conversations.isLoading && (
          <li className="flex justify-center p-6">
            <Spinner />
          </li>
        )}
        {conversations.data?.length === 0 && <li className="p-6 text-center text-sm text-stone-500">{t('No conversations yet.')}</li>}
        {conversations.data?.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              onClick={() => setParams({ with: c.user._id })}
              className={clsx('flex w-full gap-3 px-4 py-3 text-left hover:bg-stone-50', activeId === String(c.user._id) && 'bg-walnut-50')}
            >
              <Avatar name={c.user.name} />
              <span className="min-w-0 flex-1">
                <span className="flex justify-between gap-2">
                  <span className="truncate font-medium text-stone-900">{c.user.name}</span>
                  <span className="shrink-0 text-[11px] text-stone-400">{timeAgo(c.lastAt)}</span>
                </span>
                <span className="flex justify-between gap-2">
                  <span className="truncate text-sm text-stone-500">
                    {c.fromMe && 'You: '}
                    {c.lastMessage}
                  </span>
                  {c.unread > 0 && <span className="rounded-full bg-brass-500 px-1.5 text-[11px] font-bold text-walnut-950">{c.unread}</span>}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  const other = thread.data?.other;
  const chat = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-stone-100 p-4">
        <button type="button" className="rounded p-1 md:hidden" onClick={() => setParams({})} aria-label={t('Back to conversations')}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        {activeId ? (
          <>
            <Avatar name={other?.name} />
            <div>
              <p className="font-semibold">{other?.name || '…'}</p>
              {other && <p className="text-xs text-stone-500">{t(label(other.workerRole || other.role))}</p>}
            </div>
          </>
        ) : (
          <p className="font-semibold">{isCustomer ? 'Message the Wan Ofi team' : 'Select a conversation'}</p>
        )}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-stone-50/60 p-4" aria-live="polite">
        {!activeId && !isCustomer && <EmptyState title={t('No conversation selected')} message="Choose a conversation or start a new one." />}
        {!activeId && isCustomer && <p className="text-center text-sm text-stone-500">{t('Ask about orders, payments, delivery or custom designs. We usually reply within a few hours.')}</p>}
        {thread.data?.messages.map((m) => {
          const mine = String(m.sender) === String(user._id);
          return (
            <div key={m._id} className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={clsx('max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm', mine ? 'rounded-br-md bg-walnut-800 text-white' : 'rounded-bl-md bg-white text-stone-800')}>
                {m.order && <p className={clsx('mb-1 text-[11px] font-medium', mine ? 'text-brass-200' : 'text-brass-700')}>Re: {m.order.orderNumber}</p>}
                {m.attachments?.length > 0 && (
                  <div className="mb-1 mt-1 flex flex-wrap gap-2">
                    {m.attachments.map((src) => (
                      <a key={src} href={fileUrl(src)} target="_blank" rel="noreferrer">
                        <img src={fileUrl(src)} alt="Attachment" className="h-32 w-32 rounded-lg object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                <p className={clsx('mt-1 text-[10px]', mine ? 'text-walnut-200' : 'text-stone-400')}>
                  {dateTime(m.createdAt)}
                  {mine && m.isRead && ' · Read'}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {(activeId || isCustomer) && (
        <form onSubmit={submit} className="border-t border-stone-100 p-3">
          {files.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span key={`${f.name}${i}`} className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-xs">
                  {f.name}
                  <button type="button" onClick={() => setFiles((fs) => fs.filter((_, idx) => idx !== i))} aria-label={`Remove ${f.name}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = [...e.target.files].filter((f) => {
                if (f.size > 5 * 1024 * 1024) toast.error(`${f.name} is larger than 5 MB.`);
                return f.size <= 5 * 1024 * 1024;
              });
              setFiles((fs) => [...fs, ...picked].slice(0, 4));
              e.target.value = '';
            }}
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} aria-label={t('Attach photos')}>
            <Paperclip className="h-5 w-5" />
          </Button>
          <label htmlFor="message-body" className="sr-only">
            {t('Message')}
          </label>
          <textarea
            id="message-body"
            rows={1}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) submit(e);
            }}
            placeholder={t('Write a message…')}
            className="input min-h-[42px] flex-1 resize-none"
            maxLength={4000}
          />
          <Button type="submit" icon={Send} loading={send.isPending} disabled={!body.trim() && !files.length} aria-label={t('Send')}>
            <span className="hidden sm:inline">{t('Send')}</span>
          </Button>
          </div>
        </form>
      )}
    </div>
  );

  return (
    <div className="card grid h-[calc(100vh-10rem)] min-h-[480px] overflow-hidden md:grid-cols-[320px_1fr]">
      <div className={clsx('border-r border-stone-100', activeId ? 'hidden md:block' : 'block')}>{list}</div>
      <div className={clsx(activeId || isCustomer ? 'block' : 'hidden md:block')}>{chat}</div>
    </div>
  );
}
