package org.der.android.ui.qr

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
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
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

/**
 * Camera-based QR scanner. On a first successful decode, invokes
 * [onDecoded] with the payload (a DER server URL in the admin-UI
 * QR, or any URL the operator chose).
 *
 * Camera + ML Kit setup lives in this screen only so no other
 * module pays the APK cost when the operator never opens it.
 */
@Composable
fun QrScanScreen(
    onDecoded: (String) -> Unit,
    onCancel: () -> Unit,
) {
    val context = LocalContext.current
    var granted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED,
        )
    }
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { ok -> granted = ok }
    LaunchedEffect(Unit) {
        if (!granted) launcher.launch(Manifest.permission.CAMERA)
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Scan DER QR", style = MaterialTheme.typography.headlineSmall)
            if (!granted) {
                Text(
                    text = "Camera permission is required to scan the QR. Grant it in Settings → Apps → DER.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Button(
                    onClick = { launcher.launch(Manifest.permission.CAMERA) },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Grant camera permission") }
            } else {
                Box(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    CameraPreviewWithScanner(onDecoded = onDecoded)
                }
                Text(
                    text = "Point the camera at the DER admin-UI enrolment QR.",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            OutlinedButton(onClick = onCancel, modifier = Modifier.fillMaxWidth()) {
                Text("Cancel")
            }
        }
    }
}

@Composable
private fun CameraPreviewWithScanner(onDecoded: (String) -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val executor = remember { Executors.newSingleThreadExecutor() }
    val scanner = remember { BarcodeScanning.getClient() }
    val previewView = remember { PreviewView(context) }
    var fired by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        val cameraProvider = ProcessCameraProvider.getInstance(context).get()
        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(previewView.surfaceProvider)
        }
        val analyzer = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            .also { ia ->
                ia.setAnalyzer(executor) { proxy ->
                    if (fired) { proxy.close(); return@setAnalyzer }
                    val media = proxy.image
                    if (media == null) { proxy.close(); return@setAnalyzer }
                    val image = InputImage.fromMediaImage(
                        media,
                        proxy.imageInfo.rotationDegrees,
                    )
                    scanner.process(image)
                        .addOnSuccessListener { barcodes ->
                            val qr = barcodes.firstOrNull {
                                it.format == Barcode.FORMAT_QR_CODE
                            }
                            val value = qr?.rawValue
                            if (!fired && !value.isNullOrBlank()) {
                                fired = true
                                onDecoded(value.trim())
                            }
                        }
                        .addOnCompleteListener { proxy.close() }
                }
            }
        runCatching {
            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(
                lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA,
                preview, analyzer,
            )
        }
    }

    AndroidView(
        modifier = Modifier.fillMaxWidth(),
        factory = { previewView },
    )
}
