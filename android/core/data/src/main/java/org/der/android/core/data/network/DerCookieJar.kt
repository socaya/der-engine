package org.der.android.core.data.network

import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * In-memory cookie jar for the DER session cookie (`DER_SESSION`).
 * The server sets it HttpOnly + SameSite=Strict + Secure (over TLS),
 * so we never need to inspect its value — just round-trip it as-is.
 *
 * Phase 2a keeps the jar in memory; Phase 2b adds persistent
 * encrypted storage so the session survives app restarts.
 */
@Singleton
class DerCookieJar @Inject constructor() : CookieJar {

    private val cookies = ConcurrentHashMap<String, Cookie>()

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        cookies.forEach { c -> this.cookies[c.name] = c }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val now = System.currentTimeMillis()
        return cookies.values.filter { it.expiresAt >= now && it.matches(url) }
    }

    fun clear() {
        cookies.clear()
    }
}
