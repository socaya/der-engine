import axe from 'axe-core';

/**
 * NFR-26 — axe-core in Vitest.
 *
 * jsdom is a partial browser; a handful of axe rules reach into
 * CSS layout APIs (colour contrast, focusable element visibility
 * via computedStyle) that jsdom does not implement. Those rules
 * produce pseudo-violations that have nothing to do with the
 * actual component — they only reproduce on Playwright, so we
 * disable them here and keep the semantic / ARIA / role checks
 * which are the ones Vitest can honestly assert.
 */
const JSDOM_DISABLED_RULES: ReadonlyArray<string> = [
  'color-contrast',             // needs real colour math
  'color-contrast-enhanced',
  'link-in-text-block',         // computes background colour
  'landmark-one-main',          // flags mocked subtrees with no <main>
  'region',                     // same
  'scrollable-region-focusable', // needs scrollHeight / clientHeight
];

export type AxeViolation = axe.Result & { nodes: axe.NodeResult[] };

export async function runAxe(container: Element): Promise<AxeViolation[]> {
  const config: axe.RunOptions = {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] },
    rules: Object.fromEntries(
      JSDOM_DISABLED_RULES.map((id) => [id, { enabled: false }])),
  };
  const result = await axe.run(container, config);
  return result.violations as AxeViolation[];
}

/** Produces a readable summary for an axe failure so test output
 *  pinpoints the specific rule + the first failing node. */
export function formatAxeViolations(violations: AxeViolation[]): string {
  if (violations.length === 0) return 'no violations';
  return violations.map((v) => {
    const node = v.nodes[0];
    return `[${v.id}] ${v.help} · ${node?.html?.slice(0, 180) ?? '—'}`;
  }).join('\n');
}
