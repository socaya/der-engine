package org.der.android.ui.signin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.der.android.design.DerTheme

@Composable
fun SignInScreen(
    onSignedIn: () -> Unit,
    viewModel: SignInViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.signedIn) {
        if (state.signedIn) onSignedIn()
    }
    SignInContent(
        state = state,
        onUsername = viewModel::onUsername,
        onPassword = viewModel::onPassword,
        onToggleReveal = viewModel::toggleReveal,
        onSubmit = viewModel::submit,
    )
}

@Composable
private fun SignInContent(
    state: SignInViewModel.UiState,
    onUsername: (String) -> Unit,
    onPassword: (String) -> Unit,
    onToggleReveal: () -> Unit,
    onSubmit: () -> Unit,
) {
    Scaffold { padding ->
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            color = MaterialTheme.colorScheme.background,
        ) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                SignInCard(
                    state = state,
                    onUsername = onUsername,
                    onPassword = onPassword,
                    onToggleReveal = onToggleReveal,
                    onSubmit = onSubmit,
                )
            }
        }
    }
}

@Composable
private fun SignInCard(
    state: SignInViewModel.UiState,
    onUsername: (String) -> Unit,
    onPassword: (String) -> Unit,
    onToggleReveal: () -> Unit,
    onSubmit: () -> Unit,
) {
    Surface(
        tonalElevation = 2.dp,
        shadowElevation = 2.dp,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier
            .widthIn(max = 420.dp)
            .padding(horizontal = 24.dp),
    ) {
        Column(
            modifier = Modifier.padding(28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(
                text = "DER",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
            Text(
                text = "Sign in to this edge",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            OutlinedTextField(
                value = state.username,
                onValueChange = onUsername,
                label = { Text("Username") },
                singleLine = true,
                enabled = !state.submitting,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.password,
                onValueChange = onPassword,
                label = { Text("Password") },
                singleLine = true,
                enabled = !state.submitting,
                visualTransformation = if (state.revealed) {
                    VisualTransformation.None
                } else {
                    PasswordVisualTransformation()
                },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                trailingIcon = {
                    IconButton(onClick = onToggleReveal) {
                        Icon(
                            imageVector = if (state.revealed) {
                                Icons.Outlined.VisibilityOff
                            } else {
                                Icons.Outlined.Visibility
                            },
                            contentDescription = if (state.revealed) "Hide password" else "Show password",
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            )
            state.error?.let { err ->
                Text(
                    text = err,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            Spacer(Modifier.height(4.dp))
            Button(
                enabled = state.canSubmit,
                onClick = onSubmit,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                if (state.submitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.height(20.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                } else {
                    Text("Sign in")
                }
            }
            Text(
                text = "Device enrolment and biometric unlock arrive in the next phase.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun SignInPreview() {
    DerTheme {
        SignInContent(
            state = SignInViewModel.UiState(username = "chw.jane", password = "secret"),
            onUsername = {},
            onPassword = {},
            onToggleReveal = {},
            onSubmit = {},
        )
    }
}

@Preview(showBackground = true, name = "Sign-in error")
@Composable
private fun SignInErrorPreview() {
    DerTheme {
        SignInContent(
            state = SignInViewModel.UiState(
                username = "chw.jane",
                password = "wrong",
                error = "Username or password is wrong.",
            ),
            onUsername = {},
            onPassword = {},
            onToggleReveal = {},
            onSubmit = {},
        )
    }
}
