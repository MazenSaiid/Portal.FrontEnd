import { IconName } from '../../shared/ui/icon';
import { ContactChannel, CustomerType, InteractionType, PreferredLanguage } from './customers.api';

/** Display labels and icons for customer enums, in one place so every screen shows the same wording. */
export const CUSTOMER_TYPES: { value: CustomerType; label: string; icon: IconName }[] = [
  { value: 'Company', label: 'Company', icon: 'building' },
  { value: 'Individual', label: 'Individual', icon: 'user' },
];

export const CONTACT_CHANNELS: { value: ContactChannel; label: string }[] = [
  { value: 'Email', label: 'Email' },
  { value: 'Phone', label: 'Phone call' },
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'Sms', label: 'SMS' },
];

export const LANGUAGES: { value: PreferredLanguage; label: string }[] = [
  { value: 'English', label: 'English' },
  { value: 'Arabic', label: 'Arabic' },
];

export const INTERACTION_TYPES: { value: InteractionType; label: string; icon: IconName }[] = [
  { value: 'Call', label: 'Call', icon: 'phone' },
  { value: 'Email', label: 'Email', icon: 'mail' },
  { value: 'Meeting', label: 'Meeting', icon: 'calendar' },
  { value: 'WhatsApp', label: 'WhatsApp', icon: 'message' },
  { value: 'Sms', label: 'SMS', icon: 'message' },
  { value: 'Chat', label: 'Live chat', icon: 'message' },
  { value: 'Other', label: 'Other', icon: 'activity' },
];

export const channelLabel = (value: ContactChannel) => CONTACT_CHANNELS.find((c) => c.value === value)?.label ?? value;
export const interactionMeta = (value: InteractionType) =>
  INTERACTION_TYPES.find((t) => t.value === value) ?? INTERACTION_TYPES[INTERACTION_TYPES.length - 1];
