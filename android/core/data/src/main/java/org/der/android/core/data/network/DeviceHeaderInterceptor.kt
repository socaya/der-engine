package org.der.android.core.data.network

import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import org.der.android.core.data.device.DeviceIdentity
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Adds the `X-DER-Device-Id` header to every outgoing request so the
 * server's [DeviceApprovalInterceptor] can decide whether the device
 * is authorised to do more than sign in and enrol.
 *
 * The identity is resolved via `runBlocking` because OkHttp
 * interceptors are synchronous. [DeviceIdentity.deviceId] reads from
 * DataStore which is suspending but fast in practice (single
 * preferences file lookup) and the block is cold only on the first
 * request after process start.
 */
@Singleton
class DeviceHeaderInterceptor @Inject constructor(
    private val identity: DeviceIdentity,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val deviceId = runBlocking { identity.deviceId() }
        val stamped = request.newBuilder()
            .header("X-DER-Device-Id", deviceId.toString())
            .build()
        return chain.proceed(stamped)
    }
}
