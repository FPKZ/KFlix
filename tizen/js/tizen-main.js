/**
 * KFlix Tizen Web Shell (tizen-main.js)
 * Controlador principal da aplicação KFlix para Samsung Smart TV (Tizen OS / W3C Widget).
 * 
 * Gerencia o ciclo de vida do W3C Widget, registro de teclas especiais do controle remoto Samsung,
 * persistência das configurações do Jellyfin (URL, Modo D-Pad, Modo de Execução, Mouse Virtual),
 * e injeção resiliente de navegação espacial (KFlixSpatNav) e KFlixPlayer.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KFlixTizen = factory();
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var STORAGE_KEYS = {
    SERVER_URL: 'kflix_server_url',
    DPAD_MODE: 'kflix_dpad_mode',
    LAUNCH_MODE: 'kflix_launch_mode',
    VIRTUAL_MOUSE: 'kflix_virtual_mouse'
  };

  // Teclas do controle remoto Samsung Tizen
  var TIZEN_KEYS = [
    'MediaPlayPause',
    'MediaPlay',
    'MediaPause',
    'MediaFastForward',
    'MediaRewind',
    'ColorF0Red',
    'ColorF1Green',
    'ColorF2Yellow',
    'ColorF3Blue',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ];

  var KEY_CODES = {
    RETURN: 10009,
    MENU: 10133,
    COLOR_RED: 403,
    COLOR_GREEN: 404,
    COLOR_YELLOW: 405,
    COLOR_BLUE: 406,
    PLAY_PAUSE: 10252,
    PLAY: 415,
    PAUSE: 19,
    STOP: 413,
    FF: 417,
    RW: 412
  };

  class KFlixTizen {
    constructor(options) {
      options = options || {};
      this.win = options.window || (typeof window !== 'undefined' ? window : null);
      this.doc = options.document || (this.win && this.win.document ? this.win.document : null);
      this.storage = options.storage || (this.win && this.win.localStorage ? this.win.localStorage : null);
      this.player = options.player || null;
      this.spatNav = options.spatNav || null;
      this.virtualMouse = options.virtualMouse || null;

      // Callbacks customizáveis
      this._onOpenSetup = options.onOpenSetup || null;
      this._onCloseSetup = options.onCloseSetup || null;
      this._isSetupOpen = options.isSetupOpen || null;
      this._canGoBack = options.canGoBack || null;
      this._goBack = options.goBack || null;
      this._onExit = options.onExit || null;

      this.handleKeyDown = this.handleKeyDown.bind(this);
      this._initialized = false;
    }

    /**
     * Sanitiza a URL do servidor Jellyfin.
     * Adiciona http:// se nenhum protocolo for informado, remove barras finais extras e espaços.
     */
    sanitizeUrl(rawUrl) {
      if (!rawUrl || typeof rawUrl !== 'string') return '';
      var url = rawUrl.trim();
      if (!url) return '';

      // Adiciona protocolo se ausente
      if (!/^https?:\/\//i.test(url)) {
        url = 'http://' + url;
      }

      // Remove barras extras no final
      url = url.replace(/\/+$/, '');

      return url;
    }

    /**
     * Obtém a URL do servidor persistida no localStorage.
     */
    getServerUrl() {
      if (!this.storage) return null;
      return this.storage.getItem(STORAGE_KEYS.SERVER_URL) || null;
    }

    /**
     * Valida, sanitiza e salva a URL no localStorage.
     */
    saveServerUrl(url) {
      var sanitized = this.sanitizeUrl(url);
      if (!sanitized) return false;
      if (this.storage) {
        this.storage.setItem(STORAGE_KEYS.SERVER_URL, sanitized);
      }
      return true;
    }

    /**
     * Remove a URL persistida.
     */
    clearServerUrl() {
      if (this.storage) {
        this.storage.removeItem(STORAGE_KEYS.SERVER_URL);
      }
    }

    /**
     * Obtém o modo D-Pad configurado ('native' | 'spatnav'). Padrão: 'native'.
     */
    getDpadMode() {
      if (!this.storage) return 'native';
      return this.storage.getItem(STORAGE_KEYS.DPAD_MODE) || 'native';
    }

    /**
     * Salva o modo D-Pad configurado.
     */
    saveDpadMode(mode) {
      if (this.storage) {
        this.storage.setItem(STORAGE_KEYS.DPAD_MODE, mode === 'spatnav' ? 'spatnav' : 'native');
      }
    }

    /**
     * Obtém o modo de inicialização do Jellyfin ('direct' | 'iframe'). Padrão: 'direct'.
     */
    getLaunchMode() {
      if (!this.storage) return 'direct';
      return this.storage.getItem(STORAGE_KEYS.LAUNCH_MODE) || 'direct';
    }

    /**
     * Salva o modo de inicialização ('direct' | 'iframe').
     */
    saveLaunchMode(mode) {
      if (this.storage) {
        this.storage.setItem(STORAGE_KEYS.LAUNCH_MODE, mode === 'iframe' ? 'iframe' : 'direct');
      }
    }

    /**
     * Verifica se o mouse virtual está habilitado. Padrão: false.
     */
    isVirtualMouseEnabled() {
      if (!this.storage) return false;
      return this.storage.getItem(STORAGE_KEYS.VIRTUAL_MOUSE) === 'true';
    }

    /**
     * Salva a preferência de mouse virtual.
     */
    saveVirtualMouseEnabled(enabled) {
      if (this.storage) {
        this.storage.setItem(STORAGE_KEYS.VIRTUAL_MOUSE, enabled ? 'true' : 'false');
      }
    }

    /**
     * Registra teclas de mídia e cores específicas do controle remoto Samsung Tizen.
     * Executa com fallback seguro quando executado em navegadores normais ou em ambiente de teste.
     */
    registerTvKeys() {
      var tizen = this.win && this.win.tizen ? this.win.tizen : null;
      if (!tizen || !tizen.tvinputdevice || typeof tizen.tvinputdevice.registerKey !== 'function') {
        return false;
      }

      try {
        for (var i = 0; i < TIZEN_KEYS.length; i++) {
          tizen.tvinputdevice.registerKey(TIZEN_KEYS[i]);
        }
        return true;
      } catch (err) {
        console.warn('[KFlix Tizen] Falha ao registrar teclas no tvinputdevice:', err);
        return false;
      }
    }

    /**
     * Encerra a aplicação W3C no Tizen OS.
     */
    exitApp() {
      if (typeof this._onExit === 'function') {
        this._onExit();
        return;
      }

      var tizen = this.win && this.win.tizen ? this.win.tizen : null;
      if (tizen && tizen.application && typeof tizen.application.getCurrentApplication === 'function') {
        try {
          var app = tizen.application.getCurrentApplication();
          if (app && typeof app.exit === 'function') {
            app.exit();
            return;
          }
        } catch (e) {
          console.warn('[KFlix Tizen] Erro ao encerrar aplicação:', e);
        }
      }

      if (this.win && typeof this.win.close === 'function') {
        this.win.close();
      }
    }

    /**
     * Abre a interface de diálogo de configuração da URL do servidor.
     */
    openSetupDialog() {
      if (typeof this._onOpenSetup === 'function') {
        this._onOpenSetup();
        return;
      }

      if (this.doc) {
        var dialog = this.doc.getElementById('setup-dialog');
        if (dialog) {
          dialog.classList.remove('hidden');
          dialog.setAttribute('aria-hidden', 'false');

          var input = this.doc.getElementById('server-url-input');
          if (input) {
            input.value = this.getServerUrl() || '';
            setTimeout(function () { input.focus(); }, 50);
          }

          // Preenche os selects com as opções salvas
          var dpadSelect = this.doc.getElementById('dpad-mode-select');
          if (dpadSelect) {
            dpadSelect.value = this.getDpadMode();
          }

          var launchSelect = this.doc.getElementById('launch-mode-select');
          if (launchSelect) {
            launchSelect.value = this.getLaunchMode();
          }

          var mouseToggle = this.doc.getElementById('virtual-mouse-toggle');
          if (mouseToggle) {
            mouseToggle.checked = this.isVirtualMouseEnabled();
          }
        }
      }
    }

    /**
     * Fecha o diálogo de configuração do servidor.
     */
    closeSetupDialog() {
      if (typeof this._onCloseSetup === 'function') {
        this._onCloseSetup();
        return;
      }

      if (this.doc) {
        var dialog = this.doc.getElementById('setup-dialog');
        if (dialog) {
          dialog.classList.add('hidden');
          dialog.setAttribute('aria-hidden', 'true');
        }
      }
    }

    /**
     * Verifica se o diálogo de configuração está atualmente aberto.
     */
    isSetupDialogOpen() {
      if (typeof this._isSetupOpen === 'function') {
        return this._isSetupOpen();
      }

      if (this.doc) {
        var dialog = this.doc.getElementById('setup-dialog');
        if (dialog) {
          return !dialog.classList.contains('hidden') && dialog.getAttribute('aria-hidden') !== 'true';
        }
      }
      return false;
    }

    /**
     * Verifica se o iframe/webview pode voltar no histórico.
     */
    canNavigateBack() {
      if (typeof this._canGoBack === 'function') {
        return this._canGoBack();
      }

      if (this.doc) {
        var iframe = this.doc.getElementById('kflix-view');
        if (iframe && iframe.contentWindow) {
          try {
            return iframe.contentWindow.history.length > 1;
          } catch (e) {
            return false;
          }
        }
      }
      return false;
    }

    /**
     * Executa o retrocesso no histórico do iframe.
     */
    navigateBack() {
      if (typeof this._goBack === 'function') {
        this._goBack();
        return;
      }

      if (this.doc) {
        var iframe = this.doc.getElementById('kflix-view');
        if (iframe && iframe.contentWindow) {
          try {
            iframe.contentWindow.history.back();
          } catch (e) {
            console.warn('[KFlix Tizen] Erro ao voltar histórico no iframe:', e);
          }
        }
      }
    }

    /**
     * Processa eventos de tecla físicos do controle remoto Samsung.
     */
    handleKeyDown(event) {
      if (!event) return false;
      var code = event.keyCode;
      var key = event.key;

      // 1. Tecla Menu ou Vermelho: abre o diálogo de configuração
      if (code === KEY_CODES.MENU || key === 'Menu' || code === KEY_CODES.COLOR_RED || key === 'ColorF0Red') {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        this.openSetupDialog();
        return true;
      }

      // 2. Tecla Return / Back (10009 ou XF86Back)
      if (code === KEY_CODES.RETURN || key === 'XF86Back' || key === 'Return' || key === 'Back') {
        if (typeof event.preventDefault === 'function') event.preventDefault();

        // Se houver player de vídeo ativo, fecha o player primeiro
        if (this.player && typeof this.player.isVideoActive === 'function' && this.player.isVideoActive()) {
          if (typeof this.player.close === 'function') {
            this.player.close();
          } else if (typeof this.player.handleBack === 'function') {
            this.player.handleBack();
          }
          return true;
        }

        // Se o diálogo de setup estiver aberto e já houver URL válida configurada, fecha o diálogo
        if (this.isSetupDialogOpen()) {
          var currentUrl = this.getServerUrl();
          if (currentUrl) {
            this.closeSetupDialog();
            return true;
          }
          // Se não houver URL configurada e o usuário apertar Return na tela de setup, solicita saída
          this.exitApp();
          return true;
        }

        // Se estiver em modo Iframe e puder voltar o histórico do Jellyfin
        if (this.canNavigateBack()) {
          this.navigateBack();
          return true;
        }

        // Se na raiz da aplicação, encerra a aplicação
        this.exitApp();
        return true;
      }

      return false;
    }

    /**
     * Inicializa a casca Tizen Web.
     */
    init() {
      if (this._initialized) return;
      this._initialized = true;

      // Registrar teclas TV Samsung
      this.registerTvKeys();

      // Escuta global de teclas
      if (this.win && typeof this.win.addEventListener === 'function') {
        this.win.addEventListener('keydown', this.handleKeyDown, true);
      }

      // Inicializa KFlixSpatNav se disponível e habilitado
      if (this.getDpadMode() === 'spatnav') {
        if (this.spatNav && typeof this.spatNav.init === 'function') {
          this.spatNav.init();
        }
      }

      // Inicializa KFlixPlayer se disponível
      if (this.player && typeof this.player.init === 'function') {
        this.player.init();
      }

      // Inicializa Mouse Virtual se habilitado
      if (this.isVirtualMouseEnabled() && this.virtualMouse && typeof this.virtualMouse.init === 'function') {
        this.virtualMouse.init();
      }

      // Gerencia inicialização da interface no navegador
      if (this.doc) {
        this.setupUI();
      }
    }

    /**
     * Configura ouvintes da UI (botões do setup, formulário, iframe).
     */
    setupUI() {
      var self = this;
      var serverUrl = this.getServerUrl();
      var saveBtn = this.doc.getElementById('btn-save-server');
      var cancelBtn = this.doc.getElementById('btn-cancel-server');
      var input = this.doc.getElementById('server-url-input');
      var form = this.doc.getElementById('setup-form');
      var dpadSelect = this.doc.getElementById('dpad-mode-select');
      var launchSelect = this.doc.getElementById('launch-mode-select');
      var mouseToggle = this.doc.getElementById('virtual-mouse-toggle');

      var onSave = function (e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        var urlValue = input ? input.value : '';
        var sanitized = self.sanitizeUrl(urlValue);
        if (!sanitized) {
          var status = self.doc.getElementById('setup-status');
          if (status) {
            status.textContent = 'Por favor, insira uma URL válida (ex: http://192.168.1.100:8096)';
            status.className = 'status-msg error';
          }
          return;
        }

        // Salvar configurações
        self.saveServerUrl(sanitized);

        if (dpadSelect) {
          self.saveDpadMode(dpadSelect.value);
        }
        if (launchSelect) {
          self.saveLaunchMode(launchSelect.value);
        }
        if (mouseToggle) {
          self.saveVirtualMouseEnabled(mouseToggle.checked);
        }

        self.closeSetupDialog();
        self.loadServer(sanitized);
      };

      if (form) {
        form.addEventListener('submit', onSave);
      }
      if (saveBtn) {
        saveBtn.addEventListener('click', onSave);
      }
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
          if (self.getServerUrl()) {
            self.closeSetupDialog();
          }
        });
      }

      if (!serverUrl) {
        this.openSetupDialog();
      } else {
        this.loadServer(serverUrl);
      }
    }

    /**
     * Carrega a URL do servidor Jellyfin (direto ou via iframe conforme configuração).
     */
    loadServer(url) {
      if (!this.doc) return;
      var launchMode = this.getLaunchMode();
      var loader = this.doc.getElementById('app-loader');

      if (loader) {
        loader.classList.remove('hidden');
      }

      // Modo 1: Navegação direta (Recomendado para Tizen - evita bloqueios de CORS/X-Frame-Options)
      if (launchMode === 'direct') {
        if (this.win && this.win.location) {
          this.win.location.href = url;
        }
        return;
      }

      // Modo 2: Iframe embarcado
      var iframe = this.doc.getElementById('kflix-view');
      if (!iframe) return;

      iframe.src = url;

      var self = this;
      iframe.onload = function () {
        if (loader) {
          loader.classList.add('hidden');
        }
        if (self.getDpadMode() === 'spatnav') {
          self.injectEngineIntoIframe(iframe);
        }
      };

      iframe.onerror = function () {
        if (loader) {
          loader.classList.add('hidden');
        }
        var status = self.doc.getElementById('setup-status');
        if (status) {
          status.textContent = 'Não foi possível carregar o servidor Jellyfin. Verifique o endereço ou a conexão.';
          status.className = 'status-msg error';
        }
        self.openSetupDialog();
      };
    }

    /**
     * Injeta kflix-tv-theme.css e kflix-spatnav.js no iframe do Jellyfin quando acessível.
     */
    injectEngineIntoIframe(iframe) {
      try {
        var frameDoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document ? iframe.contentWindow.document : null);
        if (!frameDoc) return;

        // Injeta CSS de tema de TV
        var styleLink = frameDoc.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = 'shared/kflix-tv-theme.css';
        frameDoc.head.appendChild(styleLink);

        // Injeta spatnav e player
        var spatnavScript = frameDoc.createElement('script');
        spatnavScript.src = 'shared/kflix-spatnav.js';
        spatnavScript.onload = function () {
          var playerScript = frameDoc.createElement('script');
          playerScript.src = 'shared/kflix-player.js';
          playerScript.onload = function () {
            if (iframe.contentWindow && iframe.contentWindow.KFlixSpatNav) {
              var subNav = new iframe.contentWindow.KFlixSpatNav({
                document: frameDoc,
                window: iframe.contentWindow
              });
              subNav.init();
            }
            if (iframe.contentWindow && iframe.contentWindow.KFlixPlayer) {
              var subPlayer = new iframe.contentWindow.KFlixPlayer({
                document: frameDoc,
                window: iframe.contentWindow
              });
              subPlayer.init();
            }
          };
          frameDoc.head.appendChild(playerScript);
        };
        frameDoc.head.appendChild(spatnavScript);
      } catch (e) {
        // Bloqueio de mesma origem (CORS): comportamento padrão caso o iframe seja de outro host
      }
    }

    destroy() {
      if (!this._initialized) return;
      if (this.win && typeof this.win.removeEventListener === 'function') {
        this.win.removeEventListener('keydown', this.handleKeyDown, true);
      }
      if (this.spatNav && typeof this.spatNav.destroy === 'function') {
        this.spatNav.destroy();
      }
      if (this.player && typeof this.player.destroy === 'function') {
        this.player.destroy();
      }
      if (this.virtualMouse && typeof this.virtualMouse.destroy === 'function') {
        this.virtualMouse.destroy();
      }
      this._initialized = false;
    }
  }

  KFlixTizen.STORAGE_KEYS = STORAGE_KEYS;
  KFlixTizen.KEY_CODES = KEY_CODES;
  KFlixTizen.TIZEN_KEYS = TIZEN_KEYS;

  return KFlixTizen;
});
