import { useEffect, useRef, useState } from 'react';
import type { CaptureFormSection } from './model';

/**
 * Sticky section navigation for long forms (requirements doc
 * §UI-013 'readable typography scale … adequate touch targets',
 * §FR-009 'preserve focus, scroll position and user-entered
 * values when a rule changes visibility or layout').
 *
 * <p>Renders a scrollable chip row with one entry per form
 * section. Clicking a chip scrolls the matching
 * {@code cap-form-section} into view; an IntersectionObserver
 * highlights whichever section the operator is currently
 * reading.</p>
 *
 * <p>Suppresses itself when there are 0 or 1 sections — the chip
 * strip would be pointless noise.</p>
 */
export function SectionNav(
  { sections }: { sections: readonly CaptureFormSection[] },
): JSX.Element | null {
  const [active, setActive] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (sections.length <= 1) return;
    const legends = Array.from(document.querySelectorAll<HTMLLegendElement>(
      '.cap-form-section > legend'));
    if (legends.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      // Use the topmost visible legend as the active section — a
      // cheap stand-in for a proper scroll-spy. Debounced via
      // requestAnimationFrame so rapid scroll bursts don't
      // thrash setState.
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top
          - b.boundingClientRect.top);
      if (visible.length === 0) return;
      const label = visible[0]!.target.textContent ?? '';
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => setActive(label));
    }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });
    for (const l of legends) observer.observe(l);
    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [sections]);

  if (sections.length <= 1) return null;
  return (
    <nav className="cap-section-nav" aria-label="Form sections"
         data-test="cap-section-nav">
      {sections.map((s) => {
        const label = s.displayName || '(unnamed)';
        const isActive = label === active;
        return (
          <button key={(s.id ?? '') + label}
                  type="button"
                  className={'cap-section-nav__chip'
                    + (isActive ? ' cap-section-nav__chip--active' : '')}
                  data-test={'cap-section-nav-' + (s.id ?? label)}
                  onClick={() => {
                    const legend = Array.from(document
                      .querySelectorAll<HTMLLegendElement>(
                        '.cap-form-section > legend'))
                      .find((l) => l.textContent === label);
                    legend?.scrollIntoView({ behavior: 'smooth',
                      block: 'start' });
                    // Also focus the first input of the section
                    // so keyboard operators can type immediately.
                    const section = legend?.parentElement;
                    const firstInput = section?.querySelector<
                      HTMLInputElement>('input, select, textarea');
                    firstInput?.focus();
                  }}>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
