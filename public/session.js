// Used by browser and server: one rule for room links and protocol limits.
export const DEFAULT_ROOM = 'studio';
export const MAX_QUEUE = 60;
export const MAX_NAME = 24;
export const MAX_TITLE = 80;
export function roomName(value) {
  const name = value || DEFAULT_ROOM;
  return /^[a-zA-Z0-9_-]{1,48}$/.test(name) ? name : null;
}
export const MAX_CHAT=400,MAX_CHAT_HISTORY=10;
