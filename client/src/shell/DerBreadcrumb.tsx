import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { trailFor } from './breadcrumb';

/**
 * Tiny breadcrumb strip under the topbar.
 *
 * Reads the active pathname + maps it against the route table in
 * `breadcrumb.ts`. Renders `Home › Workflows › Capture runs`; the
 * final crumb is non-link + aria-current="page". On the root ("/")
 * no breadcrumb renders because Home is already the implicit
 * origin.
 */
export function DerBreadcrumb(): JSX.Element | null {
  const { pathname } = useLocation();
  const trail = trailFor(pathname);
  if (trail.length === 0) {
    return null;
  }
  return (
    <nav className="der-breadcrumb" aria-label="Breadcrumb" data-test="der-breadcrumb">
      <Link to="/" data-test="der-breadcrumb-home">Home</Link>
      {trail.map((c, i) => {
        const isLast = i === trail.length - 1;
        return (
          <Fragment key={i}>
            <span className="der-breadcrumb__sep" aria-hidden="true">›</span>
            {!isLast && c.to
              ? <Link to={c.to}>{c.label}</Link>
              : <span className={isLast ? 'der-breadcrumb__current' : undefined}
                      aria-current={isLast ? 'page' : undefined}
                      data-test={isLast ? 'der-breadcrumb-current' : undefined}>
                  {c.label}
                </span>}
          </Fragment>
        );
      })}
    </nav>
  );
}
