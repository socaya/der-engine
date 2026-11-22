package org.der.android.ui.unlock

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import androidx.core.content.ContextCompat

/**
 * Biometric unlock prompt shown on cold start when the operator has
 * opted in under Settings. Falls back to a "Sign out" option if the
 * device no longer has a biometric enrolled (eg. the operator cleared
 * their fingerprint after enabling the preference).
 */
@Composable
fun UnlockScreen(
    onUnlocked: () -> Unit,
    onSignOut: () -> Unit,
) {
    val activity = LocalContext.current as? FragmentActivity
    var status by remember { mutableStateOf("Tap to unlock") }
    var available by remember { mutableStateOf(true) }

    LaunchedEffect(activity) {
        val mgr = activity?.let { BiometricManager.from(it) }
        available = when (mgr?.canAuthenticate(ALLOWED_AUTHENTICATORS)) {
            BiometricManager.BIOMETRIC_SUCCESS -> true
            else -> {
                status = "This device has no biometric enrolled. Sign out to continue."
                false
            }
        }
        if (available) prompt(activity!!, onUnlocked) { status = it }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Surface(
                tonalElevation = 2.dp,
                shadowElevation = 2.dp,
                color = MaterialTheme.colorScheme.surface,
                modifier = Modifier.widthIn(max = 420.dp).padding(horizontal = 24.dp),
            ) {
                Column(
                    modifier = Modifier.padding(28.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Fingerprint,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.height(48.dp),
                    )
                    Text("Unlock DER", style = MaterialTheme.typography.titleLarge)
                    Text(
                        text = status,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(4.dp))
                    if (available && activity != null) {
                        Button(
                            onClick = { prompt(activity, onUnlocked) { status = it } },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                        ) { Text("Try again") }
                    }
                    OutlinedButton(
                        onClick = onSignOut,
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Sign out instead") }
                }
            }
        }
    }
}

private const val ALLOWED_AUTHENTICATORS: Int =
    BiometricManager.Authenticators.BIOMETRIC_WEAK or
        BiometricManager.Authenticators.DEVICE_CREDENTIAL

private fun prompt(
    activity: FragmentActivity,
    onUnlocked: () -> Unit,
    setStatus: (String) -> Unit,
) {
    val executor = ContextCompat.getMainExecutor(activity)
    val callback = object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            onUnlocked()
        }
        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
            if (errorCode != BiometricPrompt.ERROR_USER_CANCELED
                && errorCode != BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
                setStatus(errString.toString())
            } else {
                setStatus("Tap to unlock")
            }
        }
        override fun onAuthenticationFailed() {
            setStatus("Not recognised — try again.")
        }
    }
    val info = BiometricPrompt.PromptInfo.Builder()
        .setTitle("Unlock DER")
        .setSubtitle("Use biometrics or your device PIN")
        .setAllowedAuthenticators(ALLOWED_AUTHENTICATORS)
        .build()
    BiometricPrompt(activity, executor, callback).authenticate(info)
}
