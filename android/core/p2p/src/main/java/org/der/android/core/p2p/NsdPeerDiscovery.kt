package org.der.android.core.p2p

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Local-LAN peer discovery via mDNS / Bonjour (Android's
 * [NsdManager]). Complements the server-side signalling broker:
 * peers on the same WiFi find each other within seconds without
 * waiting on the next poll of `/edge-api/v1/webrtc/pending`, and
 * more importantly, continue to see each other when the edge is
 * briefly unreachable.
 *
 * The service type `_der._tcp.` is DER's reserved mDNS name — any
 * Android, web (via WebRTC's local SDP mDNS IDs) or native peer
 * that registers under it is a candidate for a DPP/1 session.
 */
@Singleton
class NsdPeerDiscovery @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val _peers = MutableStateFlow<Set<DiscoveredPeer>>(emptySet())
    val peers: Flow<Set<DiscoveredPeer>> = _peers.asStateFlow()

    data class DiscoveredPeer(
        val name: String,
        val host: String?,
        val port: Int,
    )

    private val manager: NsdManager? by lazy {
        context.getSystemService(Context.NSD_SERVICE) as? NsdManager
    }
    private var registrationListener: NsdManager.RegistrationListener? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var running = false

    fun start(selfDeviceId: String, port: Int = DEFAULT_PORT) {
        if (running) return
        val m = manager ?: run {
            Timber.w("NsdManager unavailable on this device")
            return
        }
        running = true
        register(m, selfDeviceId, port)
        discover(m)
    }

    fun stop() {
        if (!running) return
        running = false
        runCatching { registrationListener?.let { manager?.unregisterService(it) } }
        runCatching { discoveryListener?.let { manager?.stopServiceDiscovery(it) } }
        registrationListener = null
        discoveryListener = null
        _peers.value = emptySet()
    }

    private fun register(m: NsdManager, deviceId: String, port: Int) {
        val info = NsdServiceInfo().apply {
            serviceName = "der-${deviceId.take(8)}"
            serviceType = SERVICE_TYPE
            setPort(port)
        }
        val listener = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(info: NsdServiceInfo) {
                Timber.i("NSD registered as %s", info.serviceName)
            }
            override fun onRegistrationFailed(info: NsdServiceInfo, errorCode: Int) {
                Timber.w("NSD registration failed code=%d", errorCode)
            }
            override fun onServiceUnregistered(info: NsdServiceInfo) { }
            override fun onUnregistrationFailed(info: NsdServiceInfo, errorCode: Int) { }
        }
        registrationListener = listener
        runCatching {
            m.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener)
        }.onFailure { Timber.w(it, "NSD register threw") }
    }

    private fun discover(m: NsdManager) {
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) { }
            override fun onServiceFound(info: NsdServiceInfo) {
                if (!info.serviceName.startsWith("der-")) return
                // Resolve lazily on each find so we pick up new peers
                // but don't spam resolution requests on a reconnect.
                @Suppress("DEPRECATION")  // resolveService is still supported through API 35.
                m.resolveService(info, object : NsdManager.ResolveListener {
                    override fun onServiceResolved(resolved: NsdServiceInfo) {
                        val peer = DiscoveredPeer(
                            name = resolved.serviceName,
                            host = resolved.host?.hostAddress,
                            port = resolved.port,
                        )
                        _peers.update { it + peer }
                    }
                    override fun onResolveFailed(
                        info: NsdServiceInfo, errorCode: Int,
                    ) {
                        Timber.w("NSD resolve failed code=%d name=%s", errorCode, info.serviceName)
                    }
                })
            }
            override fun onServiceLost(info: NsdServiceInfo) {
                _peers.update { peers -> peers.filterNot { it.name == info.serviceName }.toSet() }
            }
            override fun onDiscoveryStopped(serviceType: String) { }
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                Timber.w("NSD discovery start failed code=%d", errorCode)
            }
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) { }
        }
        discoveryListener = listener
        runCatching {
            m.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
        }.onFailure { Timber.w(it, "NSD discoverServices threw") }
    }

    private fun MutableStateFlow<Set<DiscoveredPeer>>.update(
        block: (Set<DiscoveredPeer>) -> Set<DiscoveredPeer>,
    ) {
        value = block(value)
    }

    companion object {
        /** Reserved DER service name. The underscore + '_tcp.' suffix
         *  is the DNS-SD convention; the trailing dot matters. */
        const val SERVICE_TYPE = "_der._tcp."

        /** Advertised port. The WebRTC data channel still runs over
         *  the broker-negotiated port; this is a cosmetic hint for
         *  non-WebRTC consumers. */
        const val DEFAULT_PORT = 0
    }
}
