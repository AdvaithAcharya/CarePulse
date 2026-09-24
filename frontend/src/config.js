// Centralized API and WebSocket configuration for CarePulse

const envApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
const envWsUrl = import.meta.env.VITE_WS_URL;

const isBrowser = typeof window !== 'undefined';
const host = isBrowser ? window.location.hostname : 'localhost';
const isLocal = isBrowser && (
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host.startsWith('192.168.') ||
  host.startsWith('10.') ||
  host.endsWith('.local')
);

// Resolve HTTP API URL
export const API_BASE = envApiUrl || (
  isBrowser
    ? (isLocal ? `http://${host}:8000` : window.location.origin)
    : 'http://localhost:8000'
);

// Resolve WebSocket URL
export const WS_BASE = envWsUrl || (
  (() => {
    if (envApiUrl) {
      // Derive WS URL from API URL (https -> wss, http -> ws)
      return envApiUrl.replace(/^http/, 'ws');
    }
    if (isBrowser) {
      if (isLocal) return `ws://${host}:8000`;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${window.location.host}`;
    }
    return 'ws://localhost:8000';
  })()
);

export default {
  API_BASE,
  WS_BASE
};
