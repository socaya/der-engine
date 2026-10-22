import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// Match @dhis2/ui's `dataTest` prop, which renders as data-test="...".
configure({ testIdAttribute: 'data-test' });

afterEach(() => {
  cleanup();
});
