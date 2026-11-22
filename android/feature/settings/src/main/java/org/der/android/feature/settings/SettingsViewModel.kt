package org.der.android.feature.settings

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.der.android.core.auth.SessionRepository
import org.der.android.core.data.device.DeviceIdentity
import org.der.android.core.data.network.ServerUrlRepository
import org.der.android.core.sync.LocalDataWiper
import javax.inject.Inject

/**
 * Drives the Settings screen — server URL override, diagnostics,
 * clear-local-data. Matches the web client's Settings surface.
 */
@HiltViewModel
class SettingsViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val serverUrl: ServerUrlRepository,
    private val identity: DeviceIdentity,
    private val session: SessionRepository,
    private val wiper: LocalDataWiper,
) : ViewModel() {

    data class UiState(
        val serverUrl: String = "",
        val draftUrl: String = "",
        val saveError: String? = null,
        val saving: Boolean = false,
        val deviceId: String = "…",
        val userAgent: String = "",
        val appVersion: String = "",
        val username: String? = null,
        val pendingCaptures: Int = 0,
        val wiping: Boolean = false,
        val wiped: Boolean = false,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val current = serverUrl.current()
            val deviceId = identity.deviceId().toString()
            val user = session.current()
            val version = readVersion()
            _state.update {
                it.copy(
                    serverUrl = current,
                    draftUrl = current,
                    deviceId = deviceId,
                    userAgent = identity.userAgent(),
                    appVersion = version,
                    username = user?.username,
                    pendingCaptures = wiper.pendingCapturesCount(),
                )
            }
        }
    }

    fun onDraftUrl(v: String) = _state.update { it.copy(draftUrl = v, saveError = null) }

    fun saveUrl() {
        val draft = _state.value.draftUrl
        if (draft == _state.value.serverUrl) return
        _state.update { it.copy(saving = true, saveError = null) }
        viewModelScope.launch {
            when (val result = serverUrl.set(draft)) {
                is ServerUrlRepository.SetResult.Ok -> _state.update {
                    it.copy(saving = false, serverUrl = result.url, draftUrl = result.url)
                }
                is ServerUrlRepository.SetResult.Invalid -> _state.update {
                    it.copy(saving = false, saveError = result.reason)
                }
            }
        }
    }

    fun resetUrl() {
        _state.update { it.copy(saving = true, saveError = null) }
        viewModelScope.launch {
            serverUrl.reset()
            val next = serverUrl.current()
            _state.update { it.copy(saving = false, serverUrl = next, draftUrl = next) }
        }
    }

    fun wipeLocalData() {
        if (_state.value.wiping) return
        _state.update { it.copy(wiping = true) }
        viewModelScope.launch {
            wiper.wipe()
            _state.update { it.copy(wiping = false, wiped = true) }
        }
    }

    private fun readVersion(): String = runCatching {
        val info = context.packageManager
            .getPackageInfo(context.packageName, 0)
        "${info.versionName} (${info.longVersionCode})"
    }.getOrElse { "unknown" }
}
