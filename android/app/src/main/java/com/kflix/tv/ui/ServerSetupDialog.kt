package com.kflix.tv.ui

import android.app.Dialog
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.view.LayoutInflater
import android.view.View
import android.view.Window
import android.view.WindowManager
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.RadioButton
import android.widget.TextView
import com.kflix.tv.R
import com.kflix.tv.data.ServerConfigManager

class ServerSetupDialog(
    private val context: Context,
    private val configManager: ServerConfigManager,
    private val onConfigApplied: (url: String, mode: String, mouseEnabled: Boolean) -> Unit
) {

    private var dialog: Dialog? = null

    fun show(isCancelable: Boolean = true) {
        if (dialog?.isShowing == true) return

        val view = LayoutInflater.from(context).inflate(R.layout.dialog_server_setup, null)
        val etUrl = view.findViewById<EditText>(R.id.etServerUrl)
        val tvError = view.findViewById<TextView>(R.id.tvErrorMessage)
        val rbModeNative = view.findViewById<RadioButton>(R.id.rbModeNative)
        val rbModeSpatNav = view.findViewById<RadioButton>(R.id.rbModeSpatNav)
        val cbVirtualMouse = view.findViewById<CheckBox>(R.id.cbVirtualMouse)
        val btnSave = view.findViewById<Button>(R.id.btnSave)
        val btnCancel = view.findViewById<Button>(R.id.btnCancel)

        // Preenche com a URL atual se já configurada
        val currentUrl = configManager.getServerUrl()
        if (!currentUrl.isNullOrBlank()) {
            etUrl.setText(currentUrl)
            etUrl.setSelection(currentUrl.length)
        }

        // Carrega o modo de controle
        val currentMode = configManager.getNavigationMode()
        if (currentMode == ServerConfigManager.NAV_MODE_SPATNAV) {
            rbModeSpatNav.isChecked = true
        } else {
            rbModeNative.isChecked = true
        }

        // Carrega o estado do mouse virtual
        cbVirtualMouse.isChecked = configManager.isVirtualMouseEnabled()

        // Se o cancelamento não for permitido (ex: primeiro boot sem URL), esconde o botão Cancelar
        if (!isCancelable && !configManager.hasConfiguredServer()) {
            btnCancel.visibility = View.GONE
        } else {
            btnCancel.visibility = View.VISIBLE
        }

        val newDialog = Dialog(context).apply {
            requestWindowFeature(Window.FEATURE_NO_TITLE)
            setContentView(view)
            setCancelable(isCancelable)
            window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            window?.setLayout(
                (context.resources.displayMetrics.widthPixels * 0.85).toInt().coerceAtMost(1000),
                WindowManager.LayoutParams.WRAP_CONTENT
            )
        }

        btnSave.setOnClickListener {
            val input = etUrl.text.toString().trim()
            val sanitized = ServerConfigManager.sanitizeUrl(input)

            if (ServerConfigManager.isValidUrl(sanitized)) {
                tvError.visibility = View.GONE

                val selectedMode = if (rbModeSpatNav.isChecked) {
                    ServerConfigManager.NAV_MODE_SPATNAV
                } else {
                    ServerConfigManager.NAV_MODE_NATIVE
                }
                val mouseEnabled = cbVirtualMouse.isChecked

                configManager.setServerUrl(sanitized)
                configManager.setNavigationMode(selectedMode)
                configManager.setVirtualMouseEnabled(mouseEnabled)

                newDialog.dismiss()
                onConfigApplied(sanitized, selectedMode, mouseEnabled)
            } else {
                tvError.visibility = View.VISIBLE
                etUrl.requestFocus()
            }
        }

        btnCancel.setOnClickListener {
            newDialog.dismiss()
        }

        dialog = newDialog
        newDialog.show()
        etUrl.requestFocus()
    }

    fun dismiss() {
        dialog?.dismiss()
        dialog = null
    }

    val isShowing: Boolean
        get() = dialog?.isShowing == true
}
