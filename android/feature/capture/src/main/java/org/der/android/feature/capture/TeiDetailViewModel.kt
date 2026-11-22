package org.der.android.feature.capture

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.der.android.core.domain.Program
import org.der.android.core.domain.TrackedEntity
import org.der.android.core.sync.CaptureRepository
import javax.inject.Inject

/**
 * Detail view for one tracked entity. Shows the attributes using the
 * programme's attribute metadata so operators see human-readable
 * labels instead of raw UIDs. The 'Add stage event' FAB routes to
 * EventNew pre-filled with the TEI's orgUnit; enrolment-aware
 * pre-fill arrives when the enrolments endpoint ships client-side.
 */
@HiltViewModel
class TeiDetailViewModel @Inject constructor(
    private val repository: CaptureRepository,
    savedState: SavedStateHandle,
) : ViewModel() {

    val programId: String =
        checkNotNull(savedState.get<String>(KEY_PROGRAM_ID)) { "programId arg missing" }
    val teiUid: String =
        checkNotNull(savedState.get<String>(KEY_TEI_UID)) { "teiUid arg missing" }

    data class UiState(
        val loading: Boolean = true,
        val program: Program? = null,
        val tei: TrackedEntity? = null,
        val error: String? = null,
    ) {
        /** List of (attribute display name, value) tuples using the
         *  program's attribute metadata for labels where available. */
        val attributePairs: List<Pair<String, String>>
            get() = tei?.attributes.orEmpty().map { (uid, v) ->
                val label = program?.attributes?.firstOrNull { it.id == uid }?.displayName
                    ?: uid
                label to v
            }
    }

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val program = runCatching { repository.getProgram(programId) }.getOrNull()
            val tei = runCatching { repository.getTrackedEntity(teiUid) }.getOrNull()
            _state.update {
                it.copy(
                    loading = false,
                    program = program,
                    tei = tei,
                    error = if (tei == null) "Can't load patient $teiUid" else null,
                )
            }
        }
    }

    companion object {
        const val KEY_PROGRAM_ID = "programId"
        const val KEY_TEI_UID = "teiUid"
    }
}
