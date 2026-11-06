import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { DataProvider } from '@dhis2/app-runtime';
import App from './App';
import './styles/tokens.css';
import './styles/shell.css';
import './styles.css';

/*
 * DER device-client entry point under ADR-0004 (hybrid).
 *
 * DataProvider.baseUrl is "/" so every /api/<v>/* URL the data engine
 * generates is absolute. With baseUrl="" the engine emitted relative
 * paths which the browser resolved against the current route
 * (e.g. /aggregate/entry → /aggregate/api/44/...) and 404'd on sub-
 * pages. apiVersion is 44 to match the pinned DHIS2 reference
 * (ADR-0002); DER's /api/* responses are shape-compatible with 2.44.
 *
 * Note: @dhis2/app-runtime defaults to credentials:'include' on fetch calls,
 * so the DER_SESSION cookie flows through without extra wiring.
 */

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DataProvider baseUrl="/" apiVersion={44}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </DataProvider>
  </React.StrictMode>,
);

// §2.3.131 Progressive web app — register the shell-precaching
// service worker on production builds only. Dev (Vite + HMR) is
// skipped so stale cache entries never mask local edits. The SW
// lives at /sw.js with scope '/'; see client/public/sw.js.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch((err) => {
        console.warn('[der] service worker registration failed:', err);
      });
  });
}
