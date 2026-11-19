const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

function createMockVideo(options = {}) {
  let _paused = options.paused ?? true;
  let _currentTime = options.currentTime || 0;
  let _duration = options.duration || 120;
  let _played = false;
  let _pausedCount = 0;

  return {
    tagName: 'VIDEO',
    duration: _duration,
    get paused() { return _paused; },
    get currentTime() { return _currentTime; },
    set currentTime(val) { _currentTime = val; },
    play: () => {
      _paused = false;
      _played = true;
      return Promise.resolve();
    },
    pause: () => {
      _paused = true;
      _pausedCount++;
    },
    get wasPlayed() { return _played; },
    get pauseCount() { return _pausedCount; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1920, height: 1080, right: 1920, bottom: 1080 }),
    style: {}
  };
}

function setupMockPlayerEnv() {
  const elements = [];
  const eventListeners = {};
  let historyBackCalled = false;

  const doc = {
    elements,
    querySelector: (selector) => {
      if (selector === 'video') {
        return elements.find(el => el.tagName === 'VIDEO') || null;
      }
      return elements.find(el => el.matches && el.matches(selector)) || null;
    },
    querySelectorAll: (selector) => {
      if (selector === 'video') {
        return elements.filter(el => el.tagName === 'VIDEO');
      }
      return elements.filter(el => el.matches && el.matches(selector));
    },
    addEventListener: (event, handler) => {
      if (!eventListeners[event]) eventListeners[event] = [];
      eventListeners[event].push(handler);
    },
    removeEventListener: (event, handler) => {
      if (!eventListeners[event]) return;
      eventListeners[event] = eventListeners[event].filter(h => h !== handler);
    },
    dispatchEvent: (event) => {
      if (!eventListeners[event.type]) return;
      for (const handler of eventListeners[event.type]) {
        handler(event);
      }
    }
  };

  const win = {
    document: doc,
    addEventListener: doc.addEventListener,
    removeEventListener: doc.removeEventListener,
    dispatchEvent: doc.dispatchEvent,
    history: {
      back: () => { historyBackCalled = true; }
    },
    get historyBackCalled() { return historyBackCalled; }
  };

  global.document = doc;
  global.window = win;
  return { doc, win, elements };
}

describe('KFlix TV Player (kflix-player.js)', () => {
  let doc, win, elements, Player;

  beforeEach(() => {
    const env = setupMockPlayerEnv();
    doc = env.doc;
    win = env.win;
    elements = env.elements;

    delete require.cache[require.resolve('../kflix-player.js')];
    Player = require('../kflix-player.js');
  });

  it('deve alternar play e pause ao receber MediaPlayPause', () => {
    const video = createMockVideo({ paused: true });
    elements.push(video);

    const player = new Player({ document: doc, window: win });
    player.init();

    // 1. Play
    let prevented = false;
    doc.dispatchEvent({
      type: 'keydown',
      key: 'MediaPlayPause',
      code: 'MediaPlayPause',
      preventDefault: () => { prevented = true; }
    });

    assert.equal(video.paused, false);
    assert.equal(video.wasPlayed, true);
    assert.equal(prevented, true);

    // 2. Pause
    doc.dispatchEvent({
      type: 'keydown',
      key: 'MediaPlayPause',
      code: 'MediaPlayPause',
      preventDefault: () => {}
    });

    assert.equal(video.paused, true);
    assert.equal(video.pauseCount, 1);
  });

  it('deve avançar 10 segundos com ArrowRight / MediaFastForward quando vídeo ativo', () => {
    const video = createMockVideo({ paused: false, currentTime: 25, duration: 100 });
    elements.push(video);

    const player = new Player({ document: doc, window: win });
    player.init();

    doc.dispatchEvent({
      type: 'keydown',
      key: 'ArrowRight',
      code: 'ArrowRight',
      preventDefault: () => {}
    });

    assert.equal(video.currentTime, 35);
  });

  it('deve retroceder 10 segundos com ArrowLeft / MediaRewind respeitando limite mínimo de 0s', () => {
    const video = createMockVideo({ paused: false, currentTime: 5, duration: 100 });
    elements.push(video);

    const player = new Player({ document: doc, window: win });
    player.init();

    doc.dispatchEvent({
      type: 'keydown',
      key: 'ArrowLeft',
      code: 'ArrowLeft',
      preventDefault: () => {}
    });

    assert.equal(video.currentTime, 0);
  });

  it('deve pausar o vídeo e fechar o player ao receber Escape ou Back', () => {
    const video = createMockVideo({ paused: false, currentTime: 40 });
    elements.push(video);

    let backButtonClicked = false;
    const backBtn = {
      tagName: 'BUTTON',
      matches: (sel) => sel.includes('btnBack') || sel.includes('button[data-action="back"]'),
      click: () => { backButtonClicked = true; }
    };
    elements.push(backBtn);

    const player = new Player({ document: doc, window: win });
    player.init();

    doc.dispatchEvent({
      type: 'keydown',
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      preventDefault: () => {}
    });

    assert.equal(video.paused, true);
    assert.equal(backButtonClicked, true);
  });

  it('deve chamar window.history.back() se não houver botão de voltar no DOM', () => {
    const video = createMockVideo({ paused: false, currentTime: 40 });
    elements.push(video);

    const player = new Player({ document: doc, window: win });
    player.init();

    doc.dispatchEvent({
      type: 'keydown',
      key: 'Back',
      keyCode: 10009, // Tizen TV Return key
      preventDefault: () => {}
    });

    assert.equal(video.paused, true);
    assert.equal(win.historyBackCalled, true);
  });

  it('não deve lançar erro nem falhar quando não houver tag video no DOM', () => {
    const player = new Player({ document: doc, window: win });
    player.init();

    assert.doesNotThrow(() => {
      doc.dispatchEvent({
        type: 'keydown',
        key: 'MediaPlayPause',
        code: 'MediaPlayPause'
      });
      doc.dispatchEvent({
        type: 'keydown',
        key: 'ArrowRight',
        code: 'ArrowRight'
      });
      doc.dispatchEvent({
        type: 'keydown',
        key: 'Escape',
        code: 'Escape'
      });
    });
  });

  it('deve respeitar a duração máxima do vídeo no seek para frente', () => {
    const video = createMockVideo({ paused: false, currentTime: 95, duration: 100 });
    elements.push(video);

    const player = new Player({ document: doc, window: win });
    player.init();

    doc.dispatchEvent({
      type: 'keydown',
      key: 'ArrowRight',
      code: 'ArrowRight',
      preventDefault: () => {}
    });

    assert.equal(video.currentTime, 100);
  });
});
