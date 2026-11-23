package com.kflix.tv.ui

import android.view.KeyEvent

/**
 * Trata o mapeamento e interceptação de teclas de controle remoto para Android TV e Fire OS.
 */
class KeyEventHandler(
    private val callbacks: Callbacks
) {
    interface Callbacks {
        fun onOpenServerSetup()
        fun onToggleVirtualMouse()
        fun onExitFullscreen(): Boolean
        fun onNavigateBack(): Boolean
        fun onDispatchJsKeyEvent(key: String, code: Int)
        fun onExitApp()
    }

    private var backKeyDownTime: Long = 0L
    private var isBackLongPress = false

    private var isMenuLongPress = false

    companion object {
        const val LONG_PRESS_THRESHOLD_MS = 1000L
    }

    fun handleKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_MENU -> {
                if (event != null && event.repeatCount > 0 && !isMenuLongPress) {
                    isMenuLongPress = true
                    callbacks.onToggleVirtualMouse()
                    return true
                }
                isMenuLongPress = false
                return true
            }

            KeyEvent.KEYCODE_BACK -> {
                if (event == null || event.repeatCount == 0) {
                    backKeyDownTime = System.currentTimeMillis()
                    isBackLongPress = false
                } else if (!isBackLongPress && (System.currentTimeMillis() - backKeyDownTime) >= LONG_PRESS_THRESHOLD_MS) {
                    isBackLongPress = true
                    callbacks.onOpenServerSetup()
                    return true
                }
                return false
            }

            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> {
                callbacks.onDispatchJsKeyEvent("MediaPlayPause", 179)
                return true
            }

            KeyEvent.KEYCODE_MEDIA_PLAY -> {
                callbacks.onDispatchJsKeyEvent("MediaPlay", 250)
                return true
            }

            KeyEvent.KEYCODE_MEDIA_PAUSE -> {
                callbacks.onDispatchJsKeyEvent("MediaPause", 19)
                return true
            }

            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> {
                callbacks.onDispatchJsKeyEvent("MediaFastForward", 228)
                return true
            }

            KeyEvent.KEYCODE_MEDIA_REWIND -> {
                callbacks.onDispatchJsKeyEvent("MediaRewind", 227)
                return true
            }
        }
        return false
    }

    fun handleKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            if (isMenuLongPress) {
                isMenuLongPress = false
                return true
            }
            callbacks.onOpenServerSetup()
            return true
        }

        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (isBackLongPress) {
                isBackLongPress = false
                return true
            }

            // Se estiver em fullscreen (WebChromeClient), volta da tela cheia
            if (callbacks.onExitFullscreen()) {
                return true
            }

            // Se o histórico de navegação permitir voltar, volta a página Jellyfin
            if (callbacks.onNavigateBack()) {
                return true
            }

            // Se nada puder voltar, encerra o app
            callbacks.onExitApp()
            return true
        }
        return false
    }
}
