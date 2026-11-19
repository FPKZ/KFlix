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
import android.widget.EditText
import android.widget.TextView
import com.kflix.tv.R
import com.kflix.tv.data.ServerConfigManager

class ServerSetupDialog(
    private val context: Context,
    private val configManager: ServerConfigManager,
    private val onUrlSaved: (String) -> Unit
) {

    private var dialog: Dialog? = null

    fun show(isCancelable: Boolean = true) {
        if (dialog?.isShowing == true) return

        val view = LayoutInflater.from(context).inflate(R.layout.dialog_server_setup, null)
        val etUrl = view.findViewById<EditText>(R.id.etServerUrl)
        val tvError = view.findViewById<TextView>(R.id.tvErrorMessage)
        val btnSave = view.findViewById<Button>(R.id.btnSave)
        val btnCancel = view.findViewById<Button>(R.id.btnCancel)

        // Preenche com a URL atual se já configurada
        val currentUrl = configManager.getServerUrl()
        if (!currentUrl.isNullOrBlank()) {
            etUrl.setText(currentUrl)
            etUrl.setSelection(currentUrl.length)
        }

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
                (context.resources.displayMetrics.widthPixels * 0.75).toInt().coerceAtMost(900),
                WindowManager.LayoutParams.WRAP_CONTENT
            )
        }

        btnSave.setOnClickListener {
            val input = etUrl.text.toString().trim()
            val sanitized = ServerConfigManager.sanitizeUrl(input)

            if (ServerConfigManager.isValidUrl(sanitized)) {
                tvError.visibility = View.GONE
                configManager.setServerUrl(sanitized)
                newDialog.dismiss()
                onUrlSaved(sanitized)
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
