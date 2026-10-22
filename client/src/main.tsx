import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { DataProvider } from '@dhis2/app-runtime';
import App from './App';
import './styles.css';

/*
 * DER device-client entry point under ADR-0004 (hybrid).
 *
 * The DataProvider's baseUrl is empty on purpose: the client ships from the
 * same origin as DER (NGINX in prod, Vite proxy in dev), so every /api/* call
 * is same-origin. apiVersion is 44 to match the pinned DHIS2 reference
 * (ADR-0002); DER's /api/* responses are shape-compatible with DHIS2 2.44.
 *
 * Note: @dhis2/app-runtime defaults to credentials:'include' on fetch calls,
 * so the DER_SESSION cookie flows through without extra wiring.
 */

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DataProvider baseUrl="" apiVersion={44}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </DataProvider>
  </React.StrictMode>,
);
