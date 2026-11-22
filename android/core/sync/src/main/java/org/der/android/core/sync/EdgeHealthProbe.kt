package org.der.android.core.sync

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.der.android.core.data.network.DerApi
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Lightweight edge-reachability probe. Pings the authenticated
 * session endpoint every few seconds and publishes the outcome as
 * a Flow — the dashboard uses it to render the "Edge" card and the
 * top-bar online indicator.
 *
 * Deliberately NOT a WorkManager job: we want this to stop running
 * when no screen is observing, so the device isn't burning battery
 * on a background poll.
 */
@Singleton
class EdgeHealthProbe @Inject constructor(
    private val api: DerApi,
) {
    data class State(
        val reachable: Boolean = false,
        val lastProbeAt: Long = 0L,
        val lastError: String? = null,
    )

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _state = MutableStateFlow(State())
    val state: Flow<State> = _state.asStateFlow()

    private var subscribers = 0
    private var runner: kotlinx.coroutines.Job? = null

    /**
     * Start probing on first observer; stop when the last observer
     * cancels. Callers should pair every [attach] with [detach].
     */
    fun attach() {
        subscribers += 1
        if (runner == null) {
            runner = scope.launch { loop() }
        }
    }

    fun detach() {
        subscribers = (subscribers - 1).coerceAtLeast(0)
        if (subscribers == 0) {
            runner?.cancel()
            runner = null
        }
    }

    suspend fun probeOnce() {
        val result = runCatching { api.session() }
        val reachable = result.isSuccess && result.getOrNull()?.isSuccessful == true
        _state.update {
            State(
                reachable = reachable,
                lastProbeAt = System.currentTimeMillis(),
                lastError = when {
                    reachable -> null
                    result.isFailure -> (result.exceptionOrNull() as? IOException)?.message
                        ?: result.exceptionOrNull()?.message
                    else -> "HTTP ${result.getOrNull()?.code()}"
                },
            )
        }
    }

    private suspend fun loop() {
        while (true) {
            probeOnce()
            delay(10_000L)
        }
    }
}
