package org.der.android.design

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowDropDown
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.WeekFields
import java.util.Locale

/**
 * Period-type-aware DHIS2 picker. Produces the canonical period
 * identifier the DER edge expects (YYYY, YYYYQn, YYYYMM, YYYYWnn,
 * YYYYMMDD). Unknown period types fall back to a raw text input so
 * no dataset becomes unusable because the client didn't ship a
 * specialised picker for it yet.
 */
@Composable
fun DerPeriodPicker(
    periodType: String?,
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val normalised = periodType?.uppercase().orEmpty()
    when {
        normalised.startsWith("MONTHLY") -> MonthlyPicker(value, onChange, modifier)
        normalised == "QUARTERLY" -> QuarterlyPicker(value, onChange, modifier)
        normalised == "YEARLY" -> YearlyPicker(value, onChange, modifier)
        normalised == "WEEKLY" -> WeeklyPicker(value, onChange, modifier)
        normalised == "DAILY" -> DailyPicker(value, onChange, modifier)
        else -> FallbackPicker(periodType, value, onChange, modifier)
    }
}

@Composable
private fun DerExposedDropdown(
    label: String,
    value: String,
    options: List<String>,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }
    androidx.compose.foundation.layout.Box(modifier = modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = {
                IconButton(onClick = { expanded = !expanded }) {
                    Icon(Icons.Outlined.ArrowDropDown, contentDescription = null)
                }
            },
            modifier = Modifier.fillMaxWidth(),
        )
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
        ) {
            options.forEach { opt ->
                DropdownMenuItem(
                    text = { Text(opt) },
                    onClick = { onSelect(opt); expanded = false },
                )
            }
        }
    }
}

@Composable
private fun MonthlyPicker(value: String, onChange: (String) -> Unit, modifier: Modifier) {
    val (year, month) = parseMonthly(value)
    val years = yearsAround(year)
    val months = (1..12).map { "%02d".format(it) }
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        DerExposedDropdown(
            label = "Year",
            value = year.toString(),
            options = years.map { it.toString() },
            onSelect = { onChange(toMonthly(it.toInt(), month)) },
            modifier = Modifier.weight(1f),
        )
        DerExposedDropdown(
            label = "Month",
            value = "%02d".format(month),
            options = months,
            onSelect = { onChange(toMonthly(year, it.toInt())) },
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun QuarterlyPicker(value: String, onChange: (String) -> Unit, modifier: Modifier) {
    val (year, quarter) = parseQuarterly(value)
    val years = yearsAround(year)
    val quarters = listOf("Q1", "Q2", "Q3", "Q4")
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        DerExposedDropdown(
            label = "Year",
            value = year.toString(),
            options = years.map { it.toString() },
            onSelect = { onChange("${it}Q$quarter") },
            modifier = Modifier.weight(1f),
        )
        DerExposedDropdown(
            label = "Quarter",
            value = "Q$quarter",
            options = quarters,
            onSelect = { onChange("${year}${it}") },
            modifier = Modifier.width(140.dp),
        )
    }
}

@Composable
private fun YearlyPicker(value: String, onChange: (String) -> Unit, modifier: Modifier) {
    val year = parseYear(value)
    val years = yearsAround(year)
    DerExposedDropdown(
        label = "Year",
        value = year.toString(),
        options = years.map { it.toString() },
        onSelect = { onChange(it) },
        modifier = modifier,
    )
}

@Composable
private fun WeeklyPicker(value: String, onChange: (String) -> Unit, modifier: Modifier) {
    val (year, week) = parseWeekly(value)
    val years = yearsAround(year)
    val weeks = (1..53).map { "W%02d".format(it) }
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        DerExposedDropdown(
            label = "Year",
            value = year.toString(),
            options = years.map { it.toString() },
            onSelect = { onChange("${it}W%02d".format(week)) },
            modifier = Modifier.weight(1f),
        )
        DerExposedDropdown(
            label = "Week",
            value = "W%02d".format(week),
            options = weeks,
            onSelect = { onChange("${year}${it}") },
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun DailyPicker(value: String, onChange: (String) -> Unit, modifier: Modifier) {
    val date = parseDaily(value)
    // Compose Material3 DatePickerDialog is verbose; a readonly text
    // field with +/- buttons would be its own component. Keep it
    // pragmatic — operators type ISO dates (YYYY-MM-DD) and the
    // picker normalises to YYYYMMDD on blur.
    OutlinedTextField(
        value = date.format(DateTimeFormatter.ISO_LOCAL_DATE),
        onValueChange = {
            val d = runCatching { LocalDate.parse(it) }.getOrNull() ?: return@OutlinedTextField
            onChange(d.format(DateTimeFormatter.ofPattern("yyyyMMdd")))
        },
        label = { Text("Date (YYYY-MM-DD)") },
        singleLine = true,
        modifier = modifier.fillMaxWidth(),
    )
}

@Composable
private fun FallbackPicker(
    periodType: String?,
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = {
            Text(
                "Period" + (periodType?.let { " ($it)" } ?: ""),
            )
        },
        supportingText = { Text("Type the DHIS2 period identifier.") },
        singleLine = true,
        modifier = modifier.fillMaxWidth(),
    )
}

// ── parsing + formatting helpers ────────────────────────────────────

private val MonthlyRe = Regex("""^(\d{4})(\d{2})$""")
private val QuarterlyRe = Regex("""^(\d{4})Q(\d)$""")
private val WeeklyRe = Regex("""^(\d{4})W(\d{1,2})$""")
private val YearlyRe = Regex("""^(\d{4})$""")
private val DailyRe = Regex("""^(\d{4})(\d{2})(\d{2})$""")

private fun yearsAround(anchor: Int): List<Int> =
    (anchor - 5..anchor + 1).reversed().toList()

private fun parseMonthly(v: String): Pair<Int, Int> {
    val m = MonthlyRe.find(v)
    val year = m?.groupValues?.get(1)?.toIntOrNull() ?: LocalDate.now().year
    val month = m?.groupValues?.get(2)?.toIntOrNull()?.coerceIn(1, 12) ?: LocalDate.now().monthValue
    return year to month
}

private fun toMonthly(year: Int, month: Int): String = "%04d%02d".format(year, month)

private fun parseQuarterly(v: String): Pair<Int, Int> {
    val m = QuarterlyRe.find(v)
    val year = m?.groupValues?.get(1)?.toIntOrNull() ?: LocalDate.now().year
    val quarter = m?.groupValues?.get(2)?.toIntOrNull()?.coerceIn(1, 4) ?: 1
    return year to quarter
}

private fun parseYear(v: String): Int =
    YearlyRe.find(v)?.groupValues?.get(1)?.toIntOrNull() ?: LocalDate.now().year

private fun parseWeekly(v: String): Pair<Int, Int> {
    val m = WeeklyRe.find(v)
    val year = m?.groupValues?.get(1)?.toIntOrNull() ?: LocalDate.now().year
    val week = m?.groupValues?.get(2)?.toIntOrNull()?.coerceIn(1, 53)
        ?: LocalDate.now().get(WeekFields.of(Locale.getDefault()).weekOfWeekBasedYear())
    return year to week
}

private fun parseDaily(v: String): LocalDate {
    val m = DailyRe.find(v)
    return if (m != null) {
        LocalDate.of(
            m.groupValues[1].toInt(),
            m.groupValues[2].toInt(),
            m.groupValues[3].toInt(),
        )
    } else {
        runCatching { LocalDate.parse(v) }.getOrElse { LocalDate.now() }
    }
}
