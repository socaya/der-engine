package org.der.android.design

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * DER status token — soft background + tinted ink, no border. Mirrors
 * the web client's `.ea-status` (admin-ui styles). Uses the semantic
 * tokens from [DerColors], NOT Material's chipColors().
 */
enum class DerStatusTone { Success, Info, Warning, Danger, Muted }

@Composable
fun DerStatus(
    text: String,
    tone: DerStatusTone = DerStatusTone.Info,
    modifier: Modifier = Modifier,
) {
    val (bg, fg) = when (tone) {
        DerStatusTone.Success -> DerColors.SuccessSoft to DerColors.SuccessInk
        DerStatusTone.Info -> DerColors.InfoSoft to DerColors.InfoInk
        DerStatusTone.Warning -> DerColors.WarningSoft to DerColors.WarningInk
        DerStatusTone.Danger -> DerColors.DangerSoft to DerColors.DangerInk
        DerStatusTone.Muted -> DerColors.Ink100 to DerColors.Ink500
    }
    Box(
        modifier = modifier
            .background(color = bg, shape = RoundedCornerShape(6.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = fg,
            fontWeight = FontWeight.Medium,
        )
    }
}

/**
 * DER segmented control — two or three equal-weight choices on one
 * row. Selected segment uses `primary` ink on a soft primary
 * background; unselected uses ink on surface. No borders, no chips.
 */
@Composable
fun <T> DerSegmentedControl(
    options: List<Pair<T, String>>,
    selected: T,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(
                color = DerColors.SurfaceRaised,
                shape = RoundedCornerShape(10.dp),
            )
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        options.forEach { (value, label) ->
            val isSelected = value == selected
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(32.dp)
                    .background(
                        color = if (isSelected) DerColors.PrimarySoft else Color.Transparent,
                        shape = RoundedCornerShape(8.dp),
                    )
                    .clickable { onSelect(value) },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (isSelected) DerColors.Primary700 else DerColors.Ink700,
                )
            }
        }
    }
}

/**
 * Narrow helper that applies the common DER card chrome — soft
 * raised background, 12 dp radius, no stroke. Replaces the ad-hoc
 * `Surface(tonalElevation=1.dp)` call sites.
 */
@Composable
fun DerCard(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .widthIn(min = 0.dp)
            .background(
                color = MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(12.dp),
            ),
    ) { content() }
}
