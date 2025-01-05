package com.github.autocommiter

import com.intellij.openapi.options.Configurable
import javax.swing.JCheckBox
import javax.swing.JComponent
import javax.swing.JPanel

class AutoCommiterConfigurable : Configurable {
    private var enabledCheckBox: JCheckBox? = null
    private var modified = false

    override fun getDisplayName(): String = "Auto Commiter"

    override fun createComponent(): JComponent {
        enabledCheckBox = JCheckBox("Enable auto commit and push").apply {
            isSelected = AutoCommiterSettings.getInstance().enabled
            addActionListener { modified = true }
        }
        return JPanel().apply {
            add(enabledCheckBox)
        }
    }

    override fun isModified(): Boolean = modified

    override fun apply() {
        enabledCheckBox?.let {
            AutoCommiterSettings.getInstance().enabled = it.isSelected
        }
        modified = false
    }
} 