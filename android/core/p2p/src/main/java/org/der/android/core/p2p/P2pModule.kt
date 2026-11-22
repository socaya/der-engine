package org.der.android.core.p2p

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Binds [PeerMesh] → [WebRtcPeerMesh] app-wide. Tests swap in
 * [NullPeerMesh] (or a custom fake) by overriding this module.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class P2pModule {

    @Binds
    @Singleton
    abstract fun bindPeerMesh(impl: WebRtcPeerMesh): PeerMesh
}
