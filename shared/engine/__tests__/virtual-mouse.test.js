const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const VirtualMouse = require('../kflix-virtual-mouse.js');

function createMockElement(tag) {
  const classList = new Set();
  const children = [];
  const element = {
    tagName: tag.toUpperCase(),
    style: {},
    classList: {
      add: (c) => classList.add(c),
      remove: (c) => classList.delete(c),
      contains: (c) => classList.has(c)
    },
    textContent: '',
    appendChild: (c) => {
      children.push(c);
      c.parentNode = element;
      return c;
    },
    removeChild: (c) => {
      const idx = children.indexOf(c);
      if (idx !== -1) children.splice(idx, 1);
      c.parentNode = null;
      return c;
    },
    parentNode: null,
    click: () => { element.wasClicked = true; },
    focus: () => { element.wasFocused = true; },
    wasClicked: false,
    wasFocused: false
  };
  return element;
}

function createMockEnvironment() {
  const listeners = {};
  const body = createMockElement('body');

  const doc = {
    body,
    createElement: (tag) => createMockElement(tag),
    elementFromPoint: (x, y) => {
      return doc._targetAtPoint || null;
    },
    _targetAtPoint: null
  };

  const win = {
    innerWidth: 1920,
    innerHeight: 1080,
    scrollBy: (opts) => {
      win._lastScroll = opts;
    },
    addEventListener: (event, handler) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    removeEventListener: (event, handler) => {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(h => h !== handler);
    },
    dispatchEvent: (event) => {
      if (!listeners[event.type]) return;
      for (const h of listeners[event.type]) {
        h(event);
      }
    },
    _lastScroll: null
  };

  return { doc, win };
}

describe('KFlix Virtual Mouse (kflix-virtual-mouse.js)', () => {
  it('deve alternar estado habilitado/desabilitado com toggle()', () => {
    const { doc, win } = createMockEnvironment();
    const mouse = new VirtualMouse({ document: doc, window: win });
    mouse.init();

    assert.equal(mouse.isEnabled, false);
    mouse.toggle();
    assert.equal(mouse.isEnabled, true);
    assert.equal(win.__kflixMouseMode, true);

    mouse.toggle();
    assert.equal(mouse.isEnabled, false);
    assert.equal(win.__kflixMouseMode, false);
  });

  it('deve mover o cursor na tela ao pressionar as setas direcionais', () => {
    const { doc, win } = createMockEnvironment();
    const mouse = new VirtualMouse({ document: doc, window: win });
    mouse.init();
    mouse.toggle(); // Ativa modo mouse

    const initialX = mouse.x;
    const initialY = mouse.y;

    // Move para a direita
    win.dispatchEvent({
      type: 'keydown',
      key: 'ArrowRight',
      code: 'ArrowRight',
      preventDefault: () => {}
    });

    assert.ok(mouse.x > initialX, 'Coordenada X deve aumentar para a direita');

    // Move para baixo
    win.dispatchEvent({
      type: 'keydown',
      key: 'ArrowDown',
      code: 'ArrowDown',
      preventDefault: () => {}
    });

    assert.ok(mouse.y > initialY, 'Coordenada Y deve aumentar para baixo');
  });

  it('deve simular clique no elemento sob o cursor ao pressionar Enter', () => {
    const { doc, win } = createMockEnvironment();
    const targetButton = createMockElement('button');
    doc._targetAtPoint = targetButton;

    const mouse = new VirtualMouse({ document: doc, window: win });
    mouse.init();
    mouse.toggle();

    win.dispatchEvent({
      type: 'keydown',
      key: 'Enter',
      code: 'Enter',
      preventDefault: () => {}
    });

    assert.equal(targetButton.wasClicked, true, 'Deve acionar o clique no alvo sob o cursor');
    assert.equal(targetButton.wasFocused, true, 'Deve focar o alvo clicado');
  });

  it('deve alternar modo ao pressionar Menu duas vezes rapidamente', () => {
    const { doc, win } = createMockEnvironment();
    const mouse = new VirtualMouse({ document: doc, window: win });
    mouse.init();

    assert.equal(mouse.isEnabled, false);

    // Primeiro clique de Menu
    win.dispatchEvent({
      type: 'keydown',
      key: 'Menu',
      keyCode: 82,
      preventDefault: () => {}
    });

    assert.equal(mouse.isEnabled, false);

    // Segundo clique de Menu (duplo clique)
    win.dispatchEvent({
      type: 'keydown',
      key: 'Menu',
      keyCode: 82,
      preventDefault: () => {}
    });

    assert.equal(mouse.isEnabled, true, 'Duplo clique no Menu deve alternar para modo mouse');
  });
});
