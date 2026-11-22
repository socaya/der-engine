package org.der.android.core.sync

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import org.der.android.core.data.journal.DerDatabase
import org.der.android.core.data.network.DerCookieJar
import org.der.android.core.data.network.ServerUrlRepository
import javax.inject.Inject
import javax.inject.Singleton

private val Context.sessionStore by preferencesDataStore(name = "der-session")
private val Context.deviceStore by preferencesDataStore(name = "der-device")

/**
 * Operator-visible "reset this edge install" action. Clears every
 * piece of local state: session prefs, cookie jar, pending capture
 * journal, device identity UUID, server URL override, and any
 * queued WorkManager drains.
 *
 * Does NOT uninstall the app — Compose nav can still route back to
 * SignIn. Caller is expected to do the navigation after this
 * returns.
 */
@Singleton
class LocalDataWiper @Inject constructor(
    @ApplicationContext private val context: Context,
    private val database: DerDatabase,
    private val cookieJar: DerCookieJar,
    private val serverUrl: ServerUrlRepository,
) {

    suspend fun wipe() {
        cookieJar.clear()
        database.clearAllTables()
        context.sessionStore.edit { it.clear() }
        context.deviceStore.edit { it.clear() }
        serverUrl.reset()
        WorkManager.getInstance(context).cancelAllWork()
    }

    /** Number of pending captures currently in the local journal —
     *  shown to the operator as a confirmation hint before wiping. */
    suspend fun pendingCapturesCount(): Int =
        database.captureJournalDao().countByStatus()
}
