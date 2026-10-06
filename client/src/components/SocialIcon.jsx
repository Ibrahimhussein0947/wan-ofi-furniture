import { Facebook, Instagram, MessageCircle, Send } from 'lucide-react';

const ICONS = { facebook: Facebook, instagram: Instagram, telegram: Send, whatsapp: MessageCircle };

/** Icon for a contact channel from utils/social. */
export default function SocialIcon({ name, className }) {
  const Icon = ICONS[name] || MessageCircle;
  return <Icon className={className} aria-hidden="true" />;
}
