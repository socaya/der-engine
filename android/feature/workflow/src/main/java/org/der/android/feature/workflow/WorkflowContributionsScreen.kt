package org.der.android.feature.workflow

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.der.android.core.domain.Contribution
import org.der.android.design.R as DesignR

/**
 * Per-run audit view. Lists every contribution submitted against
 * the run, newest-first, with submitter + device + timestamp so
 * supervisors can trace the baton across service points.
 */
@Composable
fun WorkflowContributionsScreen(
    viewModel: WorkflowContributionsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = state.run?.businessKey?.let { "Case $it" } ?: "Loading…",
                style = MaterialTheme.typography.headlineSmall,
            )
            Text(
                text = stringResource(DesignR.string.workflow_contributions_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (state.loading) {
                CircularProgressIndicator()
                return@Column
            }
            if (state.contributions.isEmpty()) {
                Text(
                    text = stringResource(DesignR.string.workflow_contributions_empty),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(items = state.contributions, key = { it.contributionId }) { c ->
                        ContributionRow(c)
                    }
                }
            }
        }
    }
}

@Composable
private fun ContributionRow(c: Contribution) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        tonalElevation = 1.dp,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = c.submittedAt?.take(19)?.replace('T', ' ') ?: "—",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = "Step ${c.stepId.take(8)}…",
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                text = buildString {
                    c.submittedBy?.let { append("by ${it.take(8)}… ") }
                    c.submittedDeviceId?.let { append("· device ${it.take(8)}…") }
                },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
