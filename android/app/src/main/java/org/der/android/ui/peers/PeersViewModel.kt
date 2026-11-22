package org.der.android.ui.peers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.der.android.core.p2p.PeerMesh
import javax.inject.Inject

/**
 * Observes the peer mesh and starts it on first subscription. Phase
 * 3.5 keeps the screen read-only; the real peer-management actions
 * (invite, block, trust) land with the Workflow handoff phase.
 */
@HiltViewModel
class PeersViewModel @Inject constructor(
    private val mesh: PeerMesh,
) : ViewModel() {

    val peers: StateFlow<List<PeerMesh.Peer>> = mesh.peers
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    init {
        viewModelScope.launch { mesh.start() }
    }
}
