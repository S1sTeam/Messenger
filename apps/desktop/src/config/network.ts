const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const localBackend = 'http://localhost:3000';
const envApiOrigin = import.meta.env.VITE_API_URL?.trim();
const envSocketOrigin = import.meta.env.VITE_SOCKET_URL?.trim();
const envIceServers = import.meta.env.VITE_ICE_SERVERS?.trim();
const envTurnUrls = import.meta.env.VITE_TURN_URLS?.trim();
const envTurnUsername = import.meta.env.VITE_TURN_USERNAME?.trim();
const envTurnCredential = import.meta.env.VITE_TURN_CREDENTIAL?.trim();

const defaultApiOrigin = localBackend;

export const API_ORIGIN = stripTrailingSlash(
  envApiOrigin && envApiOrigin.length > 0 ? envApiOrigin : defaultApiOrigin
);

export const SOCKET_ORIGIN = stripTrailingSlash(
  envSocketOrigin && envSocketOrigin.length > 0 ? envSocketOrigin : API_ORIGIN
);

const defaultIceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const parseIceServers = (): RTCIceServer[] => {
  const result = [...defaultIceServers];

  if (envIceServers) {
    try {
      const parsed = JSON.parse(envIceServers);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object' && 'urls' in item) {
            result.push(item as RTCIceServer);
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse VITE_ICE_SERVERS:', error);
    }
  }

  if (envTurnUrls) {
    const turnUrls = envTurnUrls
      .split(',')
      .map((item: string) => item.trim())
      .filter(Boolean);

    if (turnUrls.length > 0) {
      result.push({
        urls: turnUrls,
        username: envTurnUsername || undefined,
        credential: envTurnCredential || undefined,
      });
    }
  }

  return result;
};

export const ICE_SERVERS = parseIceServers();

export const toBackendUrl = (url: string): string => {
  if (!url) return url;

  if (url.startsWith('http://localhost:3000')) {
    return `${API_ORIGIN}${url.slice('http://localhost:3000'.length)}`;
  }

  if (url.startsWith('https://localhost:3000')) {
    return `${API_ORIGIN}${url.slice('https://localhost:3000'.length)}`;
  }

  if (url.startsWith('/')) {
    return `${API_ORIGIN}${url}`;
  }

  return url;
};
