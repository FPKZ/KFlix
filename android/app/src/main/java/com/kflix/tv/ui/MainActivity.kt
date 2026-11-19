package com.kflix.tv.ui

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Bundle
import android.util.Base64
import android.util.Log
import android.view.KeyEvent
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
import android.widget.ProgressBar
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
            // 1. Injeta CSS de tema e foco
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

            // 2. Injeta KFlix Spatial Navigation
            val spatNavContent = readAssetFile("kflix-spatnav.js")
            if (spatNavContent.isNotEmpty()) {
                webView.evaluateJavascript(spatNavContent, null)
            }

            // 3. Injeta KFlix Player Controller
            val playerContent = readAssetFile("kflix-player.js")
            if (playerContent.isNotEmpty()) {
                webView.evaluateJavascript(playerContent, null)
            }

            // 4. Injeta KFlix Virtual Mouse (Modo Cursor TV)
            val mouseContent = readAssetFile("kflix-virtual-mouse.js")
            if (mouseContent.isNotEmpty()) {
                webView.evaluateJavascript(mouseContent, null)
            }

            Log.d(TAG, "KFlix TV Engine injetado com sucesso na WebView.")
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao injetar KFlix TV Engine: ${e.message}", e)
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
        setupDialog = ServerSetupDialog(this, configManager) { newUrl ->
            loadServer(newUrl)
        }.also {
            it.show(isCancelable)
        }
    }

    // --- KeyEventHandler.Callbacks ---

    override fun onOpenServerSetup() {
        showServerSetupDialog(isCancelable = true)
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
