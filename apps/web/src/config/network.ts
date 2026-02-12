const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const localBackend = 'http://localhost:3000';
const envApiOrigin = import.meta.env.VITE_API_URL?.trim();
const envSocketOrigin = import.meta.env.VITE_SOCKET_URL?.trim();

const defaultApiOrigin =
  import.meta.env.DEV
    ? localBackend
    : typeof window !== 'undefined'
      ? window.location.origin
      : localBackend;

export const API_ORIGIN = stripTrailingSlash(envApiOrigin && envApiOrigin.length > 0 ? envApiOrigin : defaultApiOrigin);
export const SOCKET_ORIGIN = stripTrailingSlash(envSocketOrigin && envSocketOrigin.length > 0 ? envSocketOrigin : API_ORIGIN);

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

