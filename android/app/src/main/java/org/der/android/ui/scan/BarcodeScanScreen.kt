package org.der.android.ui.scan

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Standalone scanner screen used by feature modules that don't take
 * the CameraX/ML Kit dep. Callers navigate to [DerRoute.BarcodeScan]
 * with a `resultKey` argument; on a successful decode the screen
 * writes the value into the previous nav entry's SavedStateHandle
 * under that key and pops back. The requesting screen reads the
 * value from its own SavedStateHandle on resume.
 */
@Composable
fun BarcodeScanScreen(
    title: String,
    onDecoded: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        BarcodeScanSheet(
            title = title,
            onScan = onDecoded,
            onDismiss = onDismiss,
        )
    }
}
