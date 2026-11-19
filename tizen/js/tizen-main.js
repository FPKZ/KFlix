/**
 * KFlix Tizen Web Shell (tizen-main.js)
 * Controlador principal da aplicação KFlix para Samsung Smart TV (Tizen OS / W3C Widget).
 * 
 * Gerencia o ciclo de vida do W3C Widget, registro de teclas especiais do controle remoto Samsung,
 * persistência da URL do servidor Jellyfin, injeção de navegação espacial (KFlixSpatNav) e player.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KFlixTizen = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'kflix_server_url';

  // Teclas do controle remoto Samsung Tizen
  const TIZEN_KEYS = [
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

  const KEY_CODES = {
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
    constructor(options = {}) {
      this.win = options.window || (typeof window !== 'undefined' ? window : null);
      this.doc = options.document || (this.win?.document || null);
      this.storage = options.storage || (this.win?.localStorage || null);
      this.player = options.player || null;
      this.spatNav = options.spatNav || null;

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
      let url = rawUrl.trim();
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
      return this.storage.getItem(STORAGE_KEY) || null;
    }

    /**
     * Valida, sanitiza e salva a URL no localStorage.
     */
    saveServerUrl(url) {
      const sanitized = this.sanitizeUrl(url);
      if (!sanitized) return false;
      if (this.storage) {
        this.storage.setItem(STORAGE_KEY, sanitized);
      }
      return true;
    }

    /**
     * Remove a URL persistida.
     */
    clearServerUrl() {
      if (this.storage) {
        this.storage.removeItem(STORAGE_KEY);
      }
    }

    /**
     * Registra teclas de mídia e cores específicas do controle remoto Samsung Tizen.
     * Executa com fallback seguro quando executado em navegadores normais ou em ambiente de teste.
     */
    registerTvKeys() {
      const tizen = this.win?.tizen;
      if (!tizen || !tizen.tvinputdevice || typeof tizen.tvinputdevice.registerKey !== 'function') {
        return false;
      }

      try {
        for (const keyName of TIZEN_KEYS) {
          tizen.tvinputdevice.registerKey(keyName);
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

      const tizen = this.win?.tizen;
      if (tizen?.application?.getCurrentApplication) {
        try {
          const app = tizen.application.getCurrentApplication();
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
        const dialog = this.doc.getElementById('setup-dialog');
        if (dialog) {
          dialog.classList.remove('hidden');
          dialog.setAttribute('aria-hidden', 'false');
          const input = this.doc.getElementById('server-url-input');
          if (input) {
            input.value = this.getServerUrl() || '';
            setTimeout(() => input.focus(), 50);
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
        const dialog = this.doc.getElementById('setup-dialog');
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
        const dialog = this.doc.getElementById('setup-dialog');
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
        const iframe = this.doc.getElementById('kflix-view');
        if (iframe && iframe.contentWindow) {
          try {
            return iframe.contentWindow.history.length > 1;
          } catch {
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
        const iframe = this.doc.getElementById('kflix-view');
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
      const code = event.keyCode;
      const key = event.key;

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
          const currentUrl = this.getServerUrl();
          if (currentUrl) {
            this.closeSetupDialog();
            return true;
          }
          // Se não houver URL configurada e o usuário apertar Return na tela de setup, solicita saída
          this.exitApp();
          return true;
        }

        // Se puder voltar o histórico do Jellyfin
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
      if (this.win?.addEventListener) {
        this.win.addEventListener('keydown', this.handleKeyDown, true);
      }

      // Inicializa KFlixSpatNav se disponível
      if (this.spatNav && typeof this.spatNav.init === 'function') {
        this.spatNav.init();
      }

      // Inicializa KFlixPlayer se disponível
      if (this.player && typeof this.player.init === 'function') {
        this.player.init();
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
      const serverUrl = this.getServerUrl();
      const iframe = this.doc.getElementById('kflix-view');
      const dialog = this.doc.getElementById('setup-dialog');
      const saveBtn = this.doc.getElementById('btn-save-server');
      const cancelBtn = this.doc.getElementById('btn-cancel-server');
      const input = this.doc.getElementById('server-url-input');
      const form = this.doc.getElementById('setup-form');

      const onSave = (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        const urlValue = input ? input.value : '';
        const sanitized = this.sanitizeUrl(urlValue);
        if (!sanitized) {
          const status = this.doc.getElementById('setup-status');
          if (status) {
            status.textContent = 'Por favor, insira uma URL válida (ex: http://192.168.1.100:8096)';
            status.className = 'status-msg error';
          }
          return;
        }

        this.saveServerUrl(sanitized);
        this.closeSetupDialog();
        this.loadServer(sanitized);
      };

      if (form) {
        form.addEventListener('submit', onSave);
      }
      if (saveBtn) {
        saveBtn.addEventListener('click', onSave);
      }
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          if (this.getServerUrl()) {
            this.closeSetupDialog();
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
     * Carrega a URL do servidor Jellyfin no iframe e injeta os utilitários de TV.
     */
    loadServer(url) {
      if (!this.doc) return;
      const iframe = this.doc.getElementById('kflix-view');
      const loader = this.doc.getElementById('app-loader');

      if (!iframe) return;

      if (loader) {
        loader.classList.remove('hidden');
      }

      iframe.src = url;

      iframe.onload = () => {
        if (loader) {
          loader.classList.add('hidden');
        }
        this.injectEngineIntoIframe(iframe);
      };

      iframe.onerror = () => {
        if (loader) {
          loader.classList.add('hidden');
        }
        const status = this.doc.getElementById('setup-status');
        if (status) {
          status.textContent = 'Não foi possível carregar o servidor Jellyfin. Verifique o endereço ou a conexão.';
          status.className = 'status-msg error';
        }
        this.openSetupDialog();
      };
    }

    /**
     * Injeta kflix-tv-theme.css e kflix-spatnav.js no iframe do Jellyfin quando acessível.
     */
    injectEngineIntoIframe(iframe) {
      try {
        const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!frameDoc) return;

        // Injeta CSS de tema de TV
        const styleLink = frameDoc.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = new URL('shared/kflix-tv-theme.css', this.win?.location?.href).href;
        frameDoc.head.appendChild(styleLink);

        // Injeta spatnav e player
        const spatnavScript = frameDoc.createElement('script');
        spatnavScript.src = new URL('shared/kflix-spatnav.js', this.win?.location?.href).href;
        spatnavScript.onload = () => {
          const playerScript = frameDoc.createElement('script');
          playerScript.src = new URL('shared/kflix-player.js', this.win?.location?.href).href;
          playerScript.onload = () => {
            if (iframe.contentWindow?.KFlixSpatNav) {
              const subNav = new iframe.contentWindow.KFlixSpatNav({
                document: frameDoc,
                window: iframe.contentWindow
              });
              subNav.init();
            }
            if (iframe.contentWindow?.KFlixPlayer) {
              const subPlayer = new iframe.contentWindow.KFlixPlayer({
                document: frameDoc,
                window: iframe.contentWindow
              });
              subPlayer.init();
            }
          };
          frameDoc.head.appendChild(playerScript);
        };
        frameDoc.head.appendChild(spatnavScript);
      } catch {
        // Bloqueio de mesma origem (CORS): comportamento padrão do navegador caso o iframe seja de outro host
        // As teclas registradas em nível de janela (Tizen) continuam ativas para navegação e fechamento
      }
    }

    destroy() {
      if (!this._initialized) return;
      if (this.win?.removeEventListener) {
        this.win.removeEventListener('keydown', this.handleKeyDown, true);
      }
      if (this.spatNav && typeof this.spatNav.destroy === 'function') {
        this.spatNav.destroy();
      }
      if (this.player && typeof this.player.destroy === 'function') {
        this.player.destroy();
      }
      this._initialized = false;
    }
  }

  KFlixTizen.STORAGE_KEY = STORAGE_KEY;
  KFlixTizen.KEY_CODES = KEY_CODES;
  KFlixTizen.TIZEN_KEYS = TIZEN_KEYS;

  return KFlixTizen;
});
