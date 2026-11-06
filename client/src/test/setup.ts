import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { __resetDbForTests } from '../offline/queue';

// Match @dhis2/ui's `dataTest` prop, which renders as data-test="...".
configure({ testIdAttribute: 'data-test' });

afterEach(() => {
  cleanup();
  // Close any open offline-queue IDB handle so the next test starts
  // from a fresh connection. Previous transactions on a stale handle
  // emit InvalidStateError on the next event loop otherwise.
  __resetDbForTests();
});
