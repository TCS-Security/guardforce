package com.guardforce.guard.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** Big-key numeric pad for PINs and OTPs: guards use this with one thumb, outdoors, in a hurry. */
@Composable
fun PinDots(length: Int, filled: Int, error: Boolean = false) {
    Row(horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(vertical = 12.dp)) {
        repeat(length) { i ->
            val on = i < filled
            val c = if (error) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
            Box(Modifier.size(18.dp).background(if (on) c else MaterialTheme.colorScheme.surface, CircleShape).border(2.dp, c, CircleShape))
        }
    }
}

@Composable
fun NumberPad(onDigit: (Char) -> Unit, onBackspace: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    val rows = listOf(listOf('1', '2', '3'), listOf('4', '5', '6'), listOf('7', '8', '9'), listOf(' ', '0', '<'))
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        rows.forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { key ->
                    Box(
                        Modifier.weight(1f).height(64.dp)
                            .then(if (key == ' ') Modifier else Modifier.border(1.dp, MaterialTheme.colorScheme.outline, MaterialTheme.shapes.medium).background(MaterialTheme.colorScheme.surface, MaterialTheme.shapes.medium))
                            .then(if (key != ' ' && enabled) Modifier.clickable { if (key == '<') onBackspace() else onDigit(key) } else Modifier),
                        contentAlignment = Alignment.Center,
                    ) {
                        when (key) {
                            ' ' -> Spacer(Modifier)
                            '<' -> Icon(Icons.AutoMirrored.Filled.Backspace, contentDescription = "backspace", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            else -> Text(key.toString(), style = MaterialTheme.typography.headlineMedium)
                        }
                    }
                }
            }
        }
    }
}
