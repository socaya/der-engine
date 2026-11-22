package org.der.android.feature.dataentry

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowDropDown
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.der.android.core.domain.CategoryOptionCombo
import org.der.android.core.domain.DataElement
import org.der.android.core.domain.DataSet
import org.der.android.core.domain.OptionSet

/**
 * Aggregate data-entry form. Renders by DHIS2 section when the
 * dataset ships `sections`; falls back to a flat list otherwise. Each
 * data-element cell matches its category-option-combo column —
 * greyed cells render disabled, option-set-backed fields render as a
 * dropdown, numeric types bring up the number keyboard.
 */
@Composable
fun AggregateFormScreen(
    onSaved: () -> Unit,
    viewModel: AggregateFormViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.savedId) {
        if (state.savedId != null) onSaved()
    }
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = state.dataSet?.displayName ?: "Loading…",
                style = MaterialTheme.typography.headlineSmall,
            )
            state.dataSet?.periodType?.let {
                Text(
                    text = "Period type: $it",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (state.loading) {
                CircularProgressIndicator()
                return@Column
            }
            state.error?.let { err ->
                Text(
                    text = err,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            OutlinedTextField(
                value = state.orgUnit,
                onValueChange = viewModel::onOrgUnit,
                label = { Text("Organisation unit (UID)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            org.der.android.design.DerPeriodPicker(
                periodType = state.dataSet?.periodType,
                value = state.period,
                onChange = viewModel::onPeriod,
                modifier = Modifier.fillMaxWidth(),
            )

            state.dataSet?.let { ds ->
                if (ds.sections.isEmpty()) {
                    FlatSection(
                        dataSet = ds,
                        values = state.values,
                        optionSets = state.optionSets,
                        onValue = viewModel::onValue,
                    )
                } else {
                    ds.sections.forEach { section ->
                        SectionBlock(
                            section = section,
                            dataSet = ds,
                            values = state.values,
                            optionSets = state.optionSets,
                            onValue = viewModel::onValue,
                        )
                    }
                }
            }

            state.highErrors.forEach { v ->
                Text(
                    text = "Blocking: ${v.message}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            state.mediumOrLow.forEach { v ->
                Text(
                    text = "Warning: ${v.message}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.tertiary,
                )
            }
            if (state.mediumOrLow.isNotEmpty()) {
                androidx.compose.foundation.layout.Row(
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                ) {
                    androidx.compose.material3.Checkbox(
                        checked = state.overrideWarnings,
                        onCheckedChange = { viewModel.toggleOverride() },
                    )
                    Text(
                        text = "I acknowledge the warning(s) and want to save anyway.",
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
            }

            Button(
                enabled = state.canSubmit,
                onClick = viewModel::submit,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (state.submitting) "Saving…" else "Save")
            }
            Text(
                text = "Saved values queue locally first and sync to DER in the background when online.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun SectionBlock(
    section: org.der.android.core.domain.DataSetSection,
    dataSet: DataSet,
    values: Map<String, String>,
    optionSets: Map<String, OptionSet>,
    onValue: (String, String) -> Unit,
) {
    Text(
        text = section.displayName,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(top = 4.dp),
    )
    val byId = dataSet.dataElements.associateBy { it.id }
    section.dataElementIds.forEach { deId ->
        val de = byId[deId] ?: return@forEach
        DataElementRow(
            de = de,
            values = values,
            optionSet = de.optionSetId?.let { optionSets[it] },
            isGreyed = { cocId -> org.der.android.core.domain.GreyedCell(deId, cocId) in section.greyed },
            onValue = onValue,
        )
    }
}

@Composable
private fun FlatSection(
    dataSet: DataSet,
    values: Map<String, String>,
    optionSets: Map<String, OptionSet>,
    onValue: (String, String) -> Unit,
) {
    dataSet.dataElements.forEach { de ->
        DataElementRow(
            de = de,
            values = values,
            optionSet = de.optionSetId?.let { optionSets[it] },
            isGreyed = { false },
            onValue = onValue,
        )
    }
}

@Composable
private fun DataElementRow(
    de: DataElement,
    values: Map<String, String>,
    optionSet: OptionSet?,
    isGreyed: (cocId: String) -> Boolean,
    onValue: (String, String) -> Unit,
) {
    val cocs = de.effectiveCocs
    val isMultiCell = cocs.size > 1 ||
        (cocs.size == 1 && !cocs.first().isDefault && cocs.first().id.isNotEmpty())

    Text(
        text = de.displayName,
        style = MaterialTheme.typography.labelLarge,
    )
    cocs.forEach { coc ->
        val key = if (isMultiCell && coc.id.isNotEmpty()) "${de.id}|${coc.id}" else de.id
        val greyed = coc.id.isNotEmpty() && isGreyed(coc.id)
        DataCell(
            label = if (isMultiCell) coc.displayName else de.displayName,
            value = values[key].orEmpty(),
            optionSet = optionSet,
            valueType = de.valueType,
            enabled = !greyed,
            onChange = { onValue(key, it) },
        )
    }
}

@Composable
private fun DataCell(
    label: String,
    value: String,
    optionSet: OptionSet?,
    valueType: String?,
    enabled: Boolean,
    onChange: (String) -> Unit,
) {
    if (optionSet != null) {
        OptionSetDropdown(
            label = label,
            value = value,
            options = optionSet.options,
            enabled = enabled,
            onSelect = onChange,
        )
    } else {
        OutlinedTextField(
            value = value,
            onValueChange = onChange,
            label = { Text(label) },
            singleLine = true,
            enabled = enabled,
            keyboardOptions = KeyboardOptions(
                keyboardType = when (valueType) {
                    "NUMBER", "INTEGER", "INTEGER_POSITIVE",
                    "INTEGER_ZERO_OR_POSITIVE", "PERCENTAGE" -> KeyboardType.Number
                    else -> KeyboardType.Text
                },
            ),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun OptionSetDropdown(
    label: String,
    value: String,
    options: List<org.der.android.core.domain.OptionSetOption>,
    enabled: Boolean,
    onSelect: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val display = options.firstOrNull { it.code == value }?.displayName ?: value
    androidx.compose.foundation.layout.Box(modifier = Modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = display,
            onValueChange = {},
            readOnly = true,
            enabled = enabled,
            label = { Text(label) },
            trailingIcon = {
                IconButton(onClick = { expanded = !expanded }, enabled = enabled) {
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
                    text = { Text(opt.displayName) },
                    onClick = { onSelect(opt.code); expanded = false },
                )
            }
        }
    }
}

