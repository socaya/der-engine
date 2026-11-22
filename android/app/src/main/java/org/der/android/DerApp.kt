package org.der.android

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import org.der.android.core.sync.IncomingFrameConsumer
import org.der.android.notifications.DerNotifications
import timber.log.Timber
import javax.inject.Inject

@HiltAndroidApp
class DerApp : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory
    @Inject lateinit var incomingFrameConsumer: IncomingFrameConsumer

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        CrashLogger.install(this)
        DerNotifications.ensureChannels(this)
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        }
        incomingFrameConsumer.install()
    }
}
