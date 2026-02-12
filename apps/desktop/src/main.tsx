import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initializeTheme } from './utils/theme';
import { toBackendUrl } from './config/network';
import './styles/global.css';

initializeTheme();

if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      return nativeFetch(toBackendUrl(input), init);
    }

    if (input instanceof URL) {
      return nativeFetch(new URL(toBackendUrl(input.toString())), init);
    }

    if (input instanceof Request) {
      const rewrittenUrl = toBackendUrl(input.url);
      if (rewrittenUrl !== input.url) {
        return nativeFetch(new Request(rewrittenUrl, input), init);
      }
    }

    return nativeFetch(input, init);
  }) as typeof window.fetch;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
