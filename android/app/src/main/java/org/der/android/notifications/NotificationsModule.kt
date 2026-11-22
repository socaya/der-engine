package org.der.android.notifications

import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import org.der.android.core.sync.NudgePresenter
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NotificationsModule {

    @Provides
    @Singleton
    fun provideNudgePresenter(
        @ApplicationContext context: Context,
    ): NudgePresenter = AndroidNudgePresenter(context)
}

private class AndroidNudgePresenter(
    private val context: Context,
) : NudgePresenter {
    override fun presentHandoff(fromDevice: String, runId: String?, stepId: String?) {
        DerNotifications.postWorkflowHandoff(context, fromDevice, runId, stepId)
    }
}
