import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';
import App from './App';

// ADR-0033: when DER serves the admin UI at /admin/, BrowserRouter
// needs the mount-point as its basename so <Link to="/foo"> renders
// as /admin/foo. The build-time constant comes from vite's `base`
// configured via DER_ADMIN_UI_BASE (default "/"). The trailing slash
// is stripped so basename="/" (dev) resolves to undefined.
const base = (typeof __DER_ADMIN_BASE__ !== 'undefined'
  ? __DER_ADMIN_BASE__
  : '/') as string;
const basename = base === '/' ? undefined : base.replace(/\/$/, '');

// §8 — register the offline-first service worker. Prod only (HMR
// doesn't play well with a service worker caching the shell).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' })
      .catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
