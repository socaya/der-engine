package org.der.android.ui.qr

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import org.der.android.core.data.network.ServerUrlRepository
import javax.inject.Inject

/**
 * Applies a scanned payload. Phase MVP only handles a bare DER
 * server URL — the admin-UI enrolment QR is planned to carry a
 * compact JSON payload (server URL + optional enrolment hint); the
 * JSON path lands in a follow-up once the server emits it.
 */
@HiltViewModel
class QrScanViewModel @Inject constructor(
    private val serverUrl: ServerUrlRepository,
) : ViewModel() {

    fun apply(payload: String) {
        viewModelScope.launch {
            serverUrl.set(payload)
        }
    }
}
