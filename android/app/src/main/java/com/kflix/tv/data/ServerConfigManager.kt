package com.kflix.tv.data

import android.content.Context
import android.content.SharedPreferences
import java.net.URI

class ServerConfigManager(
    private val preferences: SharedPreferences
) {
    constructor(context: Context) : this(
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    )

    companion object {
        const val PREFS_NAME = "kflix_prefs"
        const val KEY_SERVER_URL = "server_url"
        const val KEY_NAVIGATION_MODE = "navigation_mode"
        const val KEY_VIRTUAL_MOUSE_ENABLED = "virtual_mouse_enabled"

        const val NAV_MODE_NATIVE = "native"
        const val NAV_MODE_SPATNAV = "spatnav"
        const val NAV_MODE_MOUSE = "mouse"

        /**
         * Sanitiza a URL informada pelo usuário:
         * - Remove espaços nas pontas
         * - Garante esquema http:// ou https://
         * - Remove barras invertidas ou normais redundantes no final
         */
        fun sanitizeUrl(rawUrl: String): String {
            val trimmed = rawUrl.trim()
            if (trimmed.isEmpty()) return ""

            var withScheme = trimmed
            if (!withScheme.startsWith("http://", ignoreCase = true) &&
                !withScheme.startsWith("https://", ignoreCase = true)
            ) {
                withScheme = "http://$withScheme"
            }

            // Remove barras finais redundantes
            var result = withScheme
            while (result.endsWith("/")) {
                result = result.substring(0, result.length - 1)
            }
            return result
        }

        /**
         * Valida se a URL sanitizada é navegável e possui host válido.
         */
        fun isValidUrl(url: String): Boolean {
            val sanitized = sanitizeUrl(url)
            if (sanitized.isEmpty()) return false

            return try {
                val uri = URI(sanitized)
                val scheme = uri.scheme?.lowercase()
                val host = uri.host

                (scheme == "http" || scheme == "https") && !host.isNullOrBlank()
            } catch (e: Exception) {
                false
            }
        }
    }

    /**
     * Retorna a URL do servidor configurada, ou null se não configurada.
     */
    fun getServerUrl(): String? {
        val stored = preferences.getString(KEY_SERVER_URL, null)
        return if (!stored.isNullOrBlank()) stored else null
    }

    /**
     * Sanitiza e salva a URL no SharedPreferences de forma persistente.
     */
    fun setServerUrl(url: String) {
        val sanitized = sanitizeUrl(url)
        preferences.edit().putString(KEY_SERVER_URL, sanitized).apply()
    }

    /**
     * Verifica se existe uma URL válida e configurada.
     */
    fun hasConfiguredServer(): Boolean {
        val url = getServerUrl()
        return !url.isNullOrBlank() && isValidUrl(url)
    }

    /**
     * Retorna o modo de navegação configurado:
     * - "native": Deixa o Jellyfin TV responder nativamente sem injeção de spatnav
     * - "spatnav": Usa o motor espacial KFlix (para sites comuns/desktop)
     * - "mouse": Modo mouse virtual
     */
    fun getNavigationMode(): String {
        return preferences.getString(KEY_NAVIGATION_MODE, NAV_MODE_NATIVE) ?: NAV_MODE_NATIVE
    }

    fun setNavigationMode(mode: String) {
        preferences.edit().putString(KEY_NAVIGATION_MODE, mode).apply()
    }

    fun isVirtualMouseEnabled(): Boolean {
        return preferences.getBoolean(KEY_VIRTUAL_MOUSE_ENABLED, false) || getNavigationMode() == NAV_MODE_MOUSE
    }

    fun setVirtualMouseEnabled(enabled: Boolean) {
        preferences.edit().putBoolean(KEY_VIRTUAL_MOUSE_ENABLED, enabled).apply()
    }

    fun isSpatNavEnabled(): Boolean {
        return getNavigationMode() == NAV_MODE_SPATNAV
    }

    /**
     * Remove a URL configurada.
     */
    fun clear() {
        preferences.edit().remove(KEY_SERVER_URL).apply()
    }
}
