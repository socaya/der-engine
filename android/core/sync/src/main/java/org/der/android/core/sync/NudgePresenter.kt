package org.der.android.core.sync

/**
 * Pluggable surface the [IncomingFrameConsumer] uses to notify
 * operators out-of-process. The app module supplies a
 * notification-backed implementation; tests supply a no-op or a
 * capturing double. Kept in core/sync so the consumer stays
 * decoupled from `android.app.Notification`.
 */
interface NudgePresenter {
    fun presentHandoff(fromDevice: String, runId: String?, stepId: String?)
}

/** Fallback when no app-side implementation is bound. */
class NoopNudgePresenter : NudgePresenter {
    override fun presentHandoff(fromDevice: String, runId: String?, stepId: String?) { }
}
