package org.der.android

import android.content.Context
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.time.Instant

/**
 * Writes uncaught-exception stack traces to internal storage so the
 * next launch can surface them in Settings → Send feedback.
 *
 * Intentionally dependency-free. Installing a crash reporter like
 * Firebase Crashlytics would add Play Services and a transitive
 * network dependency the pilot facilities don't want; this keeps
 * the signal local until operators choose to mail it out.
 */
object CrashLogger {

    private const val FILE_NAME = "der-last-crash.log"
    private const val MAX_BYTES = 128 * 1024L  // 128 KB cap

    fun install(context: Context) {
        val appContext = context.applicationContext
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            runCatching { write(appContext, thread, throwable) }
            previous?.uncaughtException(thread, throwable)
        }
    }

    /** Null when no crash is on record. */
    fun readLastCrash(context: Context): String? {
        val f = file(context)
        if (!f.exists() || f.length() == 0L) return null
        return runCatching { f.readText() }.getOrNull()
    }

    fun clear(context: Context) {
        runCatching { file(context).delete() }
    }

    private fun file(context: Context): File =
        File(context.filesDir, FILE_NAME)

    private fun write(context: Context, thread: Thread, throwable: Throwable) {
        val sw = StringWriter()
        PrintWriter(sw).use { pw ->
            pw.println("DER Android crash")
            pw.println("At      : ${Instant.now()}")
            pw.println("Thread  : ${thread.name}")
            pw.println("Message : ${throwable.message}")
            pw.println("-- stack --")
            throwable.printStackTrace(pw)
        }
        val f = file(context)
        f.writeText(sw.toString().take(MAX_BYTES.toInt()))
    }
}
