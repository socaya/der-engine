package ug.ac.mak.der.dhis2emulator;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Stamps {@code Cache-Control: no-store, must-revalidate} on every
 * {@code /api/*} response so the browser's HTTP cache can't serve a
 * stale body back to an embedded DHIS2 app.
 *
 * <p>Context: DHIS2 custom apps (eregisters, Capture) persist pulled
 * metadata into an app-local SQLite / IndexedDB store. If the
 * browser's own HTTP cache has a copy of {@code
 * /api/44/programs/<uid>} from an earlier pull (back when the
 * emulator returned {@code programStages} as id-only stubs), a
 * forced re-sync fetches that cached 200 instead of hitting the
 * server. The app saves the stale shape locally and crashes at
 * {@code deriveValidIds} with {@code Cannot read properties of
 * undefined (reading 'map')} because {@code
 * programStageDataElements} is undefined. A simple {@code "Clear
 * site data"} doesn't help — the user has to also tick "Cached
 * images and files", which they rarely do.</p>
 *
 * <p>No-store flatly tells the browser not to write {@code /api/*}
 * responses into its disk/mem cache. Pairs with the DHIS2 custom
 * apps' own {@code wa-sqlite} offline store, which still holds
 * the only sanctioned copy of persisted data.</p>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 75)
public class NoStoreApiFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(final HttpServletRequest request,
                                        final HttpServletResponse response,
                                        final FilterChain chain)
            throws ServletException, IOException {
        final String uri = request.getRequestURI();
        if (uri != null && uri.startsWith("/api/")) {
            response.setHeader("Cache-Control",
                    "no-store, must-revalidate");
            response.setHeader("Pragma", "no-cache");
        }
        chain.doFilter(request, response);
    }
}
