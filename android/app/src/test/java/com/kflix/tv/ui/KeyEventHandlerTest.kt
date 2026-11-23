package com.kflix.tv.ui

import android.view.KeyEvent
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`

class KeyEventHandlerTest {

    private lateinit var callbacks: KeyEventHandler.Callbacks
    private lateinit var handler: KeyEventHandler

    @Before
    fun setUp() {
        callbacks = mock(KeyEventHandler.Callbacks::class.java)
        handler = KeyEventHandler(callbacks)
    }

    @Test
    fun `menu key up triggers open server setup`() {
        val event = mock(KeyEvent::class.java)
        `when`(event.repeatCount).thenReturn(0)

        handler.handleKeyDown(KeyEvent.KEYCODE_MENU, event)
        val consumed = handler.handleKeyUp(KeyEvent.KEYCODE_MENU, event)

        assertTrue(consumed)
        verify(callbacks).onOpenServerSetup()
    }

    @Test
    fun `menu key repeat triggers toggle virtual mouse`() {
        val event = mock(KeyEvent::class.java)
        `when`(event.repeatCount).thenReturn(1)

        val consumed = handler.handleKeyDown(KeyEvent.KEYCODE_MENU, event)

        assertTrue(consumed)
        verify(callbacks).onToggleVirtualMouse()
        verify(callbacks, never()).onOpenServerSetup()
    }

    @Test
    fun `media play pause key dispatches js event`() {
        val event = mock(KeyEvent::class.java)
        val consumed = handler.handleKeyDown(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, event)

        assertTrue(consumed)
        verify(callbacks).onDispatchJsKeyEvent("MediaPlayPause", 179)
    }

    @Test
    fun `media fast forward key dispatches js event`() {
        val event = mock(KeyEvent::class.java)
        val consumed = handler.handleKeyDown(KeyEvent.KEYCODE_MEDIA_FAST_FORWARD, event)

        assertTrue(consumed)
        verify(callbacks).onDispatchJsKeyEvent("MediaFastForward", 228)
    }

    @Test
    fun `back key up exits fullscreen if fullscreen active`() {
        val event = mock(KeyEvent::class.java)
        `when`(callbacks.onExitFullscreen()).thenReturn(true)

        val consumed = handler.handleKeyUp(KeyEvent.KEYCODE_BACK, event)

        assertTrue(consumed)
        verify(callbacks).onExitFullscreen()
        verify(callbacks, never()).onNavigateBack()
        verify(callbacks, never()).onExitApp()
    }

    @Test
    fun `back key up navigates back if webView can go back`() {
        val event = mock(KeyEvent::class.java)
        `when`(callbacks.onExitFullscreen()).thenReturn(false)
        `when`(callbacks.onNavigateBack()).thenReturn(true)

        val consumed = handler.handleKeyUp(KeyEvent.KEYCODE_BACK, event)

        assertTrue(consumed)
        verify(callbacks).onExitFullscreen()
        verify(callbacks).onNavigateBack()
        verify(callbacks, never()).onExitApp()
    }

    @Test
    fun `back key up exits app if not fullscreen and cannot go back`() {
        val event = mock(KeyEvent::class.java)
        `when`(callbacks.onExitFullscreen()).thenReturn(false)
        `when`(callbacks.onNavigateBack()).thenReturn(false)

        val consumed = handler.handleKeyUp(KeyEvent.KEYCODE_BACK, event)

        assertTrue(consumed)
        verify(callbacks).onExitFullscreen()
        verify(callbacks).onNavigateBack()
        verify(callbacks).onExitApp()
    }

    @Test
    fun `unhandled key returns false`() {
        val event = mock(KeyEvent::class.java)
        val consumed = handler.handleKeyDown(KeyEvent.KEYCODE_DPAD_CENTER, event)

        assertFalse(consumed)
    }
}
