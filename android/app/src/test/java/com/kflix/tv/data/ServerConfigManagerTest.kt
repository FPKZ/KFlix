package com.kflix.tv.data

import android.content.SharedPreferences
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.ArgumentMatchers.anyString
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`

class ServerConfigManagerTest {

    private lateinit var sharedPreferences: SharedPreferences
    private lateinit var editor: SharedPreferences.Editor
    private lateinit var serverConfigManager: ServerConfigManager
    private val memoryStorage = mutableMapOf<String, String>()

    @Before
    fun setUp() {
        sharedPreferences = mock(SharedPreferences::class.java)
        editor = mock(SharedPreferences.Editor::class.java)

        `when`(sharedPreferences.edit()).thenReturn(editor)
        `when`(editor.putString(anyString(), anyString())).thenAnswer { invocation ->
            val key = invocation.arguments[0] as String
            val value = invocation.arguments[1] as String
            memoryStorage[key] = value
            editor
        }
        `when`(editor.remove(anyString())).thenAnswer { invocation ->
            val key = invocation.arguments[0] as String
            memoryStorage.remove(key)
            editor
        }
        `when`(sharedPreferences.getString(anyString(), org.mockito.ArgumentMatchers.nullable(String::class.java))).thenAnswer { invocation ->
            val key = invocation.arguments[0] as String
            val default = invocation.arguments[1] as? String
            memoryStorage[key] ?: default
        }

        serverConfigManager = ServerConfigManager(sharedPreferences)
        memoryStorage.clear()
    }

    @Test
    fun `sanitizeUrl prepends http if scheme missing`() {
        val result = ServerConfigManager.sanitizeUrl("192.168.1.50:8096")
        assertEquals("http://192.168.1.50:8096", result)
    }

    @Test
    fun `sanitizeUrl keeps existing http or https scheme`() {
        assertEquals("http://192.168.1.50:8096", ServerConfigManager.sanitizeUrl("http://192.168.1.50:8096"))
        assertEquals("https://demo.jellyfin.org", ServerConfigManager.sanitizeUrl("https://demo.jellyfin.org"))
    }

    @Test
    fun `sanitizeUrl removes trailing slashes`() {
        val result = ServerConfigManager.sanitizeUrl("http://192.168.1.50:8096///")
        assertEquals("http://192.168.1.50:8096", result)
    }

    @Test
    fun `sanitizeUrl trims surrounding whitespace`() {
        val result = ServerConfigManager.sanitizeUrl("   192.168.1.50:8096/   ")
        assertEquals("http://192.168.1.50:8096", result)
    }

    @Test
    fun `sanitizeUrl returns empty string for blank input`() {
        assertEquals("", ServerConfigManager.sanitizeUrl(""))
        assertEquals("", ServerConfigManager.sanitizeUrl("   "))
    }

    @Test
    fun `isValidUrl validates correctly`() {
        assertTrue(ServerConfigManager.isValidUrl("http://192.168.1.50:8096"))
        assertTrue(ServerConfigManager.isValidUrl("https://jellyfin.example.com"))
        assertTrue(ServerConfigManager.isValidUrl("192.168.1.100:8096"))
        assertFalse(ServerConfigManager.isValidUrl(""))
        assertFalse(ServerConfigManager.isValidUrl("   "))
        assertFalse(ServerConfigManager.isValidUrl("http://"))
    }

    @Test
    fun `setServerUrl sanitizes and persists in SharedPreferences`() {
        serverConfigManager.setServerUrl("192.168.1.50:8096/")
        
        verify(editor).apply()
        assertEquals("http://192.168.1.50:8096", serverConfigManager.getServerUrl())
        assertTrue(serverConfigManager.hasConfiguredServer())
    }

    @Test
    fun `getServerUrl returns null when not set`() {
        assertNull(serverConfigManager.getServerUrl())
        assertFalse(serverConfigManager.hasConfiguredServer())
    }

    @Test
    fun `clear removes stored server url`() {
        serverConfigManager.setServerUrl("http://192.168.1.50:8096")
        assertTrue(serverConfigManager.hasConfiguredServer())

        serverConfigManager.clear()
        assertNull(serverConfigManager.getServerUrl())
        assertFalse(serverConfigManager.hasConfiguredServer())
    }
}
