package org.der.android.core.data.network

import kotlinx.coroutines.runBlocking
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Rewrites every outgoing request's scheme + host + port + path
 * prefix to point at the URL stored in [ServerUrlRepository]. Lets
 * Settings change the server URL at runtime without rebuilding the
 * Retrofit / OkHttp stack.
 *
 * Retrofit's `baseUrl` is still set at construction (it has to be
 * non-null to build the request path); this interceptor overrides
 * that baseline whenever the DataStore entry differs.
 */
@Singleton
class HostSelectionInterceptor @Inject constructor(
    private val repository: ServerUrlRepository,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val configured = runBlocking { repository.current() }.toHttpUrlOrNull()
            ?: return chain.proceed(original)

        val rewritten = original.url.newBuilder()
            .scheme(configured.scheme)
            .host(configured.host)
            .port(configured.port)
            .build()
        return chain.proceed(original.newBuilder().url(rewritten).build())
    }
}
