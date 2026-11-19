const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const KFlixTizen = require('../js/tizen-main.js');

describe('KFlix Tizen Web Shell Tests', () => {
  let mockLocalStorage;
  let mockStorageData;
  let mockTizen;
  let mockWindow;
  let mockDocument;
  let registeredKeys;
  let exitCalled;

  beforeEach(() => {
    mockStorageData = {};
    mockLocalStorage = {
      getItem: (key) => (key in mockStorageData ? mockStorageData[key] : null),
      setItem: (key, val) => { mockStorageData[key] = String(val); },
      removeItem: (key) => { delete mockStorageData[key]; },
      clear: () => { mockStorageData = {}; }
    };

    registeredKeys = [];
    exitCalled = false;

    mockTizen = {
      tvinputdevice: {
        registerKey: (keyName) => {
          registeredKeys.push(keyName);
        }
      },
      application: {
        getCurrentApplication: () => ({
          exit: () => {
            exitCalled = true;
          }
        })
      }
    };

    mockDocument = {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    mockWindow = {
      localStorage: mockLocalStorage,
      tizen: mockTizen,
      document: mockDocument,
      addEventListener: () => {},
      removeEventListener: () => {}
    };
  });

  describe('URL Sanitization & Persistence', () => {
    it('deve sanitizar URL adicionando http:// se o protocolo estiver ausente', () => {
      const app = new KFlixTizen({ window: mockWindow });
      const sanitized = app.sanitizeUrl('192.168.1.100:8096');
      assert.equal(sanitized, 'http://192.168.1.100:8096');
    });

    it('deve manter https:// se já fornecido', () => {
      const app = new KFlixTizen({ window: mockWindow });
      const sanitized = app.sanitizeUrl('https://jellyfin.meudominio.com:8920');
      assert.equal(sanitized, 'https://jellyfin.meudominio.com:8920');
    });

    it('deve remover barras finais extras da URL', () => {
      const app = new KFlixTizen({ window: mockWindow });
      const sanitized = app.sanitizeUrl('http://192.168.1.100:8096///');
      assert.equal(sanitized, 'http://192.168.1.100:8096');
    });

    it('deve remover espaços no início e final da URL', () => {
      const app = new KFlixTizen({ window: mockWindow });
      const sanitized = app.sanitizeUrl('   http://192.168.1.50:8096/  ');
      assert.equal(sanitized, 'http://192.168.1.50:8096');
    });

    it('deve retornar string vazia para entradas nulas ou inválidas', () => {
      const app = new KFlixTizen({ window: mockWindow });
      assert.equal(app.sanitizeUrl(''), '');
      assert.equal(app.sanitizeUrl(null), '');
      assert.equal(app.sanitizeUrl(undefined), '');
      assert.equal(app.sanitizeUrl('   '), '');
    });

    it('deve salvar e carregar a URL no localStorage', () => {
      const app = new KFlixTizen({ window: mockWindow });
      assert.equal(app.getServerUrl(), null);

      const success = app.saveServerUrl('192.168.1.100:8096/');
      assert.equal(success, true);
      assert.equal(app.getServerUrl(), 'http://192.168.1.100:8096');
      assert.equal(mockLocalStorage.getItem('kflix_server_url'), 'http://192.168.1.100:8096');
    });

    it('deve rejeitar salvar URL vazia', () => {
      const app = new KFlixTizen({ window: mockWindow });
      const success = app.saveServerUrl('');
      assert.equal(success, false);
      assert.equal(app.getServerUrl(), null);
    });
  });

  describe('Tizen Key Registration & Safe Fallback', () => {
    it('deve registrar teclas especiais da TV Samsung via tizen.tvinputdevice.registerKey', () => {
      const app = new KFlixTizen({ window: mockWindow });
      const result = app.registerTvKeys();
      assert.equal(result, true);
      assert.ok(registeredKeys.includes('MediaPlayPause'));
      assert.ok(registeredKeys.includes('MediaPlay'));
      assert.ok(registeredKeys.includes('MediaPause'));
      assert.ok(registeredKeys.includes('MediaFastForward'));
      assert.ok(registeredKeys.includes('MediaRewind'));
      assert.ok(registeredKeys.includes('ColorF0Red'));
      assert.ok(registeredKeys.includes('ColorF1Green'));
    });

    it('deve executar fallback seguro sem falhar quando window.tizen não existe', () => {
      mockWindow.tizen = undefined;
      const app = new KFlixTizen({ window: mockWindow });
      assert.doesNotThrow(() => {
        const result = app.registerTvKeys();
        assert.equal(result, false);
      });
    });

    it('deve lidar graciosamente se tvinputdevice.registerKey lançar erro', () => {
      mockTizen.tvinputdevice.registerKey = () => {
        throw new Error('Key not supported on this model');
      };
      const app = new KFlixTizen({ window: mockWindow });
      assert.doesNotThrow(() => {
        const result = app.registerTvKeys();
        assert.equal(result, false);
      });
    });
  });

  describe('Key Handling (Return 10009 and Menu 10133 / Red 403)', () => {
    it('deve abrir o diálogo de configuração ao pressionar a tecla Menu (10133)', () => {
      let setupOpened = false;
      const app = new KFlixTizen({
        window: mockWindow,
        onOpenSetup: () => { setupOpened = true; }
      });

      const handled = app.handleKeyDown({ keyCode: 10133, key: 'Menu', preventDefault: () => {} });
      assert.equal(handled, true);
      assert.equal(setupOpened, true);
    });

    it('deve abrir o diálogo de configuração ao pressionar a tecla ColorF0Red (403)', () => {
      let setupOpened = false;
      const app = new KFlixTizen({
        window: mockWindow,
        onOpenSetup: () => { setupOpened = true; }
      });

      const handled = app.handleKeyDown({ keyCode: 403, key: 'ColorF0Red', preventDefault: () => {} });
      assert.equal(handled, true);
      assert.equal(setupOpened, true);
    });

    it('ao pressionar Return (10009), deve fechar o player se houver vídeo ativo', () => {
      let playerClosed = false;
      const mockPlayer = {
        isVideoActive: () => true,
        close: () => { playerClosed = true; }
      };

      const app = new KFlixTizen({
        window: mockWindow,
        player: mockPlayer
      });

      const handled = app.handleKeyDown({ keyCode: 10009, key: 'XF86Back', preventDefault: () => {} });
      assert.equal(handled, true);
      assert.equal(playerClosed, true);
      assert.equal(exitCalled, false);
    });

    it('ao pressionar Return (10009), deve fechar o diálogo de setup se estiver aberto e já houver URL', () => {
      mockLocalStorage.setItem('kflix_server_url', 'http://192.168.1.100:8096');
      let setupClosed = false;

      const app = new KFlixTizen({
        window: mockWindow,
        isSetupOpen: () => true,
        onCloseSetup: () => { setupClosed = true; }
      });

      const handled = app.handleKeyDown({ keyCode: 10009, key: 'XF86Back', preventDefault: () => {} });
      assert.equal(handled, true);
      assert.equal(setupClosed, true);
      assert.equal(exitCalled, false);
    });

    it('ao pressionar Return (10009) na raiz da aplicação, deve solicitar saída com tizen.application.exit()', () => {
      const app = new KFlixTizen({
        window: mockWindow,
        isSetupOpen: () => false,
        canGoBack: () => false
      });

      const handled = app.handleKeyDown({ keyCode: 10009, key: 'XF86Back', preventDefault: () => {} });
      assert.equal(handled, true);
      assert.equal(exitCalled, true);
    });

    it('ao pressionar Return (10009) com histórico web no iframe, deve retroceder histórico', () => {
      let navigatedBack = false;
      const app = new KFlixTizen({
        window: mockWindow,
        isSetupOpen: () => false,
        canGoBack: () => true,
        goBack: () => { navigatedBack = true; }
      });

      const handled = app.handleKeyDown({ keyCode: 10009, key: 'XF86Back', preventDefault: () => {} });
      assert.equal(handled, true);
      assert.equal(navigatedBack, true);
      assert.equal(exitCalled, false);
    });
  });
});
