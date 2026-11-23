package com.kflix.tv.ui

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Bundle
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.kflix.tv.R
import com.kflix.tv.data.ServerConfigManager
import java.io.BufferedReader
import java.io.InputStreamReader

class MainActivity : AppCompatActivity(), KeyEventHandler.Callbacks {

    companion object {
        private const val TAG = "KFlixMainActivity"
    }

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var customViewContainer: FrameLayout
    private lateinit var errorContainer: View
    private lateinit var btnRetry: Button
    private lateinit var btnConfigServer: Button

    // Cursor do Mouse Virtual Nativo na TV
    private lateinit var ivVirtualCursor: ImageView
    private var isMouseModeActive = false
    private var cursorX = 500f
    private var cursorY = 300f

    private lateinit var configManager: ServerConfigManager
    private lateinit var keyEventHandler: KeyEventHandler
    private var setupDialog: ServerSetupDialog? = null

    // Suporte a Fullscreen no WebChromeClient
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        configManager = ServerConfigManager(this)
        keyEventHandler = KeyEventHandler(this)

        initViews()
        configureWebView()
        setupListeners()

        updateMouseModeState(configManager.isVirtualMouseEnabled(), showToast = false)

        val serverUrl = configManager.getServerUrl()
        if (serverUrl.isNullOrBlank() || !ServerConfigManager.isValidUrl(serverUrl)) {
            showServerSetupDialog(isCancelable = false)
        } else {
            loadServer(serverUrl)
        }
    }

    private fun initViews() {
        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)
        customViewContainer = findViewById(R.id.customViewContainer)
        errorContainer = findViewById(R.id.errorContainer)
        btnRetry = findViewById(R.id.btnRetry)
        btnConfigServer = findViewById(R.id.btnConfigServer)
        ivVirtualCursor = findViewById(R.id.ivVirtualCursor)
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Suppress("DEPRECATION")
    private fun configureWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true

        // Habilita cookies persistentes
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (customView != null) {
                    onHideCustomView()
                    return
                }
                customView = view
                customViewCallback = callback

                webView.visibility = View.GONE
                customViewContainer.addView(view)
                customViewContainer.visibility = View.VISIBLE
            }

            override fun onHideCustomView() {
                customView?.let { view ->
                    customViewContainer.removeView(view)
                    customViewContainer.visibility = View.GONE
                    customView = null
                    customViewCallback?.onCustomViewHidden()
                    customViewCallback = null
                    webView.visibility = View.VISIBLE
                }
            }

            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress >= 100) {
                    progressBar.visibility = View.GONE
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressBar.visibility = View.VISIBLE
                errorContainer.visibility = View.GONE
                webView.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
                injectKFlixEngine()
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    showErrorScreen()
                }
            }

            @Suppress("DEPRECATION")
            override fun onReceivedError(
                view: WebView?,
                errorCode: Int,
                description: String?,
                failingUrl: String?
            ) {
                super.onReceivedError(view, errorCode, description, failingUrl)
                showErrorScreen()
            }
        }
    }

    private fun setupListeners() {
        btnRetry.setOnClickListener {
            val url = configManager.getServerUrl()
            if (!url.isNullOrBlank()) {
                loadServer(url)
            } else {
                showServerSetupDialog()
            }
        }

        btnConfigServer.setOnClickListener {
            showServerSetupDialog()
        }
    }

    private fun loadServer(url: String) {
        errorContainer.visibility = View.GONE
        webView.visibility = View.VISIBLE
        progressBar.visibility = View.VISIBLE
        Log.d(TAG, "Carregando servidor: $url")
        webView.loadUrl(url)
    }

    private fun showErrorScreen() {
        progressBar.visibility = View.GONE
        webView.visibility = View.GONE
        errorContainer.visibility = View.VISIBLE
        btnConfigServer.requestFocus()
    }

    /**
     * Injeta os arquivos CSS e JS do KFlix TV Engine na WebView.
     */
    private fun injectKFlixEngine() {
        try {
            // 1. Sempre injeta o CSS de tema e foco (remove barras de rolagem e desobstrui overlays do Jellyfin)
            val cssContent = readAssetFile("kflix-tv-theme.css")
            if (cssContent.isNotEmpty()) {
                val encodedCss = Base64.encodeToString(cssContent.toByteArray(), Base64.NO_WRAP)
                val cssScript = """
                    (function() {
                        var existing = document.getElementById('kflix-tv-theme-style');
                        if (!existing) {
                            var style = document.createElement('style');
                            style.id = 'kflix-tv-theme-style';
                            style.textContent = window.atob('$encodedCss');
                            (document.head || document.documentElement).appendChild(style);
                        }
                    })();
                """.trimIndent()
                webView.evaluateJavascript(cssScript, null)
            }

            // 2. Injeta KFlix Spatial Navigation SOMENTE se o modo SpatNav customizado estiver ativado!
            // No modo nativo (padrão recomendado para Jellyfin TV), o Jellyfin gerencia o D-Pad diretamente
            // evitando que o foco pule de 2 em 2 itens.
            if (configManager.isSpatNavEnabled()) {
                val spatNavContent = readAssetFile("kflix-spatnav.js")
                if (spatNavContent.isNotEmpty()) {
                    webView.evaluateJavascript(spatNavContent, null)
                    Log.d(TAG, "KFlix SpatNav injetado.")
                }
            } else {
                Log.d(TAG, "Modo Jellyfin TV Nativo ativo: SpatNav não injetado para evitar pulo duplo.")
            }

            // 3. Injeta KFlix Player Controller
            val playerContent = readAssetFile("kflix-player.js")
            if (playerContent.isNotEmpty()) {
                webView.evaluateJavascript(playerContent, null)
            }

            Log.d(TAG, "KFlix TV Engine configurado com sucesso.")
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao configurar KFlix TV Engine: ${e.message}", e)
        }
    }

    private fun readAssetFile(filename: String): String {
        return try {
            assets.open(filename).use { inputStream ->
                BufferedReader(InputStreamReader(inputStream)).use { reader ->
                    reader.readText()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao ler asset $filename: ${e.message}")
            ""
        }
    }

    fun showServerSetupDialog(isCancelable: Boolean = true) {
        setupDialog?.dismiss()
        setupDialog = ServerSetupDialog(this, configManager) { newUrl, mode, mouseEnabled ->
            updateMouseModeState(mouseEnabled, showToast = true)
            loadServer(newUrl)
        }.also {
            it.show(isCancelable)
        }
    }

    /**
     * Atualiza o estado do Mouse Virtual Nativo
     */
    fun updateMouseModeState(enabled: Boolean, showToast: Boolean = true) {
        isMouseModeActive = enabled
        if (isMouseModeActive) {
            ivVirtualCursor.visibility = View.VISIBLE
            val metrics = resources.displayMetrics
            cursorX = metrics.widthPixels / 2f
            cursorY = metrics.heightPixels / 2f
            ivVirtualCursor.translationX = cursorX
            ivVirtualCursor.translationY = cursorY
            ivVirtualCursor.bringToFront()
            if (showToast) {
                Toast.makeText(this, "🖱️ Modo Mouse Ativado (D-Pad move, OK clica)", Toast.LENGTH_SHORT).show()
            }
        } else {
            ivVirtualCursor.visibility = View.GONE
            if (showToast) {
                Toast.makeText(this, "📺 Modo TV D-Pad Ativado", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun simulateClickAt(x: Float, y: Float) {
        val downTime = SystemClock.uptimeMillis()
        val eventTime = SystemClock.uptimeMillis()
        // Ajusta ligeiramente para a ponta da seta
        val targetX = x + 4f
        val targetY = y + 4f

        val downEvent = MotionEvent.obtain(downTime, eventTime, MotionEvent.ACTION_DOWN, targetX, targetY, 0)
        val upEvent = MotionEvent.obtain(downTime, eventTime + 50, MotionEvent.ACTION_UP, targetX, targetY, 0)

        webView.dispatchTouchEvent(downEvent)
        webView.dispatchTouchEvent(upEvent)

        downEvent.recycle()
        upEvent.recycle()

        // Efeito visual de clique na seta do mouse
        ivVirtualCursor.animate().scaleX(0.75f).scaleY(0.75f).setDuration(60).withEndAction {
            ivVirtualCursor.animate().scaleX(1.0f).scaleY(1.0f).setDuration(60).start()
        }.start()
    }

    // --- KeyEventHandler.Callbacks ---

    override fun onOpenServerSetup() {
        showServerSetupDialog(isCancelable = true)
    }

    override fun onToggleVirtualMouse() {
        val newState = !isMouseModeActive
        configManager.setVirtualMouseEnabled(newState)
        updateMouseModeState(newState, showToast = true)
    }

    override fun onExitFullscreen(): Boolean {
        if (customView != null) {
            webView.webChromeClient?.onHideCustomView()
            return true
        }
        return false
    }

    override fun onNavigateBack(): Boolean {
        if (webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return false
    }

    override fun onDispatchJsKeyEvent(key: String, code: Int) {
        val js = """
            (function() {
                var event = new KeyboardEvent('keydown', {
                    key: '$key',
                    code: '$key',
                    keyCode: $code,
                    which: $code,
                    bubbles: true,
                    cancelable: true
                });
                document.dispatchEvent(event);
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    override fun onExitApp() {
        finish()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // Se o modo Mouse Virtual estiver ativo, intercepta o D-Pad para mover a seta e clicar
        if (isMouseModeActive) {
            val metrics = resources.displayMetrics
            val screenW = metrics.widthPixels.toFloat()
            val screenH = metrics.heightPixels.toFloat()
            val step = if ((event?.repeatCount ?: 0) > 0) 36f else 18f

            when (keyCode) {
                KeyEvent.KEYCODE_DPAD_UP -> {
                    cursorY = (cursorY - step).coerceAtLeast(10f)
                    ivVirtualCursor.translationY = cursorY
                    if (cursorY < 90) webView.scrollBy(0, -50)
                    return true
                }
                KeyEvent.KEYCODE_DPAD_DOWN -> {
                    cursorY = (cursorY + step).coerceAtMost(screenH - 30f)
                    ivVirtualCursor.translationY = cursorY
                    if (cursorY > screenH - 90) webView.scrollBy(0, 50)
                    return true
                }
                KeyEvent.KEYCODE_DPAD_LEFT -> {
                    cursorX = (cursorX - step).coerceAtLeast(10f)
                    ivVirtualCursor.translationX = cursorX
                    return true
                }
                KeyEvent.KEYCODE_DPAD_RIGHT -> {
                    cursorX = (cursorX + step).coerceAtMost(screenW - 30f)
                    ivVirtualCursor.translationX = cursorX
                    return true
                }
                KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                    simulateClickAt(cursorX, cursorY)
                    return true
                }
            }
        }

        if (keyEventHandler.handleKeyDown(keyCode, event)) {
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyEventHandler.handleKeyUp(keyCode, event)) {
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        super.onDestroy()
        setupDialog?.dismiss()
        CookieManager.getInstance().flush()
        webView.destroy()
    }
}
