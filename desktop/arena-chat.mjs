export const ARENA_CHAT_URL = 'https://arena.ai/';
export const ARENA_BTW_CHAT_URL = 'https://arena.ai/chat/direct?model_a=claude-sonnet-5-5-high';
export const ARENA_CHAT_PARTITION = 'persist:arena-chat';

const ARENA_CHAT_ALLOWED_HOSTS = [
  'arena.ai',
  'lmarena.ai',
  'google.com',
  'challenges.cloudflare.com',
];

export function isArenaChatUrlAllowed(rawUrl) {
  try {
    const url = new URL(String(rawUrl));
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return ARENA_CHAT_ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

// OAuth providers often create an about:blank window before navigating it to the
// provider. Permit only that initial empty document; navigation remains allowlisted.
export function isArenaChatPageUrlAllowed(rawUrl) {
  if (!isArenaChatUrlAllowed(rawUrl)) return false;
  try {
    const host = new URL(String(rawUrl)).hostname.toLowerCase().replace(/\.$/, '');
    return ['arena.ai', 'lmarena.ai'].some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

export function isArenaChatPopupUrlAllowed(rawUrl) {
  return String(rawUrl) === 'about:blank' || isArenaChatUrlAllowed(rawUrl);
}
