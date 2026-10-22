import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// Honour our data-test convention (same as client).
configure({ testIdAttribute: 'data-test' });

// RTL does not auto-cleanup under Vitest; register one here so each `it` block
// starts with an empty document body. Without this, repeated renders cascade and
// `getBy*` queries fail with "Found multiple elements".
afterEach(() => {
  cleanup();
});
