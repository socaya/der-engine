package org.der.android.core.data.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Locks the URL-normalisation contract. The OkHttp interceptor
 * depends on these invariants: every stored URL has an explicit
 * scheme, no trailing slash, and no path component beyond '/'.
 */
class ServerUrlRepositoryTest {
    private fun n(raw: String) = ServerUrlRepository.normalise(raw)

    @Test fun acceptsHttps() {
        assertEquals("https://der.example.org", n("https://der.example.org"))
    }

    @Test fun acceptsHttpWithPort() {
        assertEquals("http://192.168.1.42:8085", n("http://192.168.1.42:8085"))
    }

    @Test fun stripsTrailingSlash() {
        assertEquals("http://der/", n("http://der/")?.plus("/"))
        assertEquals("http://der.example.org", n("http://der.example.org/"))
    }

    @Test fun rejectsBareHost() {
        assertNull(n("der.example.org"))
    }

    @Test fun rejectsEmpty() {
        assertNull(n(""))
        assertNull(n("   "))
    }

    @Test fun rejectsGibberish() {
        assertNull(n("not a url"))
    }
}
