package com.github.autocommiter

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.components.service

@State(
    name = "AutoCommiterSettings",
    storages = [Storage("autoCommiterSettings.xml")]
)
class AutoCommiterSettings : PersistentStateComponent<AutoCommiterSettings.State> {
    data class State(
        var enabled: Boolean = true
    )

    private var myState = State()

    override fun getState(): State = myState

    override fun loadState(state: State) {
        myState = state
    }

    var enabled: Boolean
        get() = myState.enabled
        set(value) {
            myState.enabled = value
        }

    companion object {
        fun getInstance(): AutoCommiterSettings = service()
    }
} 