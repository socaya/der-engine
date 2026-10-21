import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL does not auto-cleanup under Vitest; register one here so each `it` block
// starts with an empty document body. Without this, repeated renders cascade and
// `getBy*` queries fail with "Found multiple elements".
afterEach(() => {
  cleanup();
});
