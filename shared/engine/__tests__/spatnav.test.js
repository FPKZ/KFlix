const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Criação de Mock DOM leve para Smart TV
function createMockElement(tagName, options = {}) {
  const classList = new Set(options.classes || []);
  const attributes = new Map(Object.entries(options.attributes || {}));
  let _rect = options.rect || { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 };
  let _focused = false;
  let _clicked = false;
  let _scrolled = false;

  const element = {
    tagName: tagName.toUpperCase(),
    style: options.style || {},
    classList: {
      add: (cls) => classList.add(cls),
      remove: (cls) => classList.delete(cls),
      contains: (cls) => classList.has(cls),
      toString: () => Array.from(classList).join(' ')
    },
    getAttribute: (attr) => attributes.get(attr) || null,
    setAttribute: (attr, val) => attributes.set(attr, String(val)),
    hasAttribute: (attr) => attributes.has(attr),
    getBoundingClientRect: () => ({ ..._rect }),
    setRect: (newRect) => {
      _rect = {
        left: newRect.left || 0,
        top: newRect.top || 0,
        width: newRect.width || 0,
        height: newRect.height || 0,
        right: (newRect.left || 0) + (newRect.width || 0),
        bottom: (newRect.top || 0) + (newRect.height || 0)
      };
    },
    focus: () => {
      _focused = true;
      if (global.document) {
        if (global.document.activeElement && global.document.activeElement !== element) {
          if (global.document.activeElement._blur) global.document.activeElement._blur();
        }
        global.document.activeElement = element;
      }
    },
    blur: () => {
      _focused = false;
      if (global.document && global.document.activeElement === element) {
        global.document.activeElement = null;
      }
    },
    _blur: () => {
      _focused = false;
    },
    click: () => {
      _clicked = true;
      if (options.onClick) options.onClick();
    },
    scrollIntoView: (opts) => {
      _scrolled = true;
      element._scrollOpts = opts;
    },
    get isFocused() { return _focused; },
    get wasClicked() { return _clicked; },
    get wasScrolled() { return _scrolled; },
    matches: (selector) => {
      const parts = selector.split(',').map(s => s.trim());
      return parts.some(part => {
        if (part.startsWith('.')) return classList.has(part.substring(1));
        if (part.startsWith('[') && part.endsWith(']')) {
          const attr = part.substring(1, part.length - 1);
          if (attr.includes('=')) {
            const [k, v] = attr.split('=').map(x => x.replace(/['"]/g, '').trim());
            return attributes.get(k) === v;
          }
          return attributes.has(attr);
        }
        return tagName.toLowerCase() === part.toLowerCase();
      });
    },
    closest: (selector) => {
      let current = element;
      while (current) {
        if (current.matches && current.matches(selector)) return current;
        current = current.parentElement;
      }
      return null;
    },
    querySelector: (selector) => {
      const search = (node) => {
        if (!node.children) return null;
        for (const child of node.children) {
          if (child.matches && child.matches(selector)) return child;
          const found = search(child);
          if (found) return found;
        }
        return null;
      };
      return search(element);
    },
    appendChild: (child) => {
      if (!element.children) element.children = [];
      element.children.push(child);
      child.parentElement = element;
      return child;
    }
  };

  return element;
}

function setupMockDocument() {
  const elements = [];
  const eventListeners = {};

  const doc = {
    activeElement: null,
    elements,
    createElement: (tag) => {
      const el = createMockElement(tag);
      return el;
    },
    querySelectorAll: (selector) => {
      return elements.filter(el => {
        // Elementos invisíveis ou com display none não são navegáveis
        if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        return el.matches(selector);
      });
    },
    querySelector: (selector) => {
      const all = doc.querySelectorAll(selector);
      return all.length > 0 ? all[0] : null;
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
    innerWidth: 1920,
    innerHeight: 1080
  };

  global.document = doc;
  global.window = win;
  return { doc, win, elements };
}

describe('KFlix Spatial Navigation (kflix-spatnav.js)', () => {
  let doc, win, elements, SpatNav;

  beforeEach(() => {
    const env = setupMockDocument();
    doc = env.doc;
    win = env.win;
    elements = env.elements;
    // Carregar módulo
    delete require.cache[require.resolve('../kflix-spatnav.js')];
    SpatNav = require('../kflix-spatnav.js');
  });

  it('deve selecionar apenas elementos navegáveis e visíveis', () => {
    const btn = createMockElement('button', { classes: ['emby-button'] });
    btn.setRect({ left: 10, top: 10, width: 100, height: 40 });
    elements.push(btn);

    const card = createMockElement('div', { classes: ['card'] });
    card.setRect({ left: 120, top: 10, width: 150, height: 220 });
    elements.push(card);

    const hiddenCard = createMockElement('div', { classes: ['card'], style: { display: 'none' } });
    hiddenCard.setRect({ left: 300, top: 10, width: 150, height: 220 });
    elements.push(hiddenCard);

    const zeroSizeCard = createMockElement('div', { classes: ['card'] });
    zeroSizeCard.setRect({ left: 500, top: 10, width: 0, height: 0 });
    elements.push(zeroSizeCard);

    const spatNav = new SpatNav({ document: doc, window: win });
    const focusable = spatNav.getFocusableElements();

    assert.equal(focusable.length, 2);
    assert.equal(focusable[0], btn);
    assert.equal(focusable[1], card);
  });

  it('deve focar automaticamente o primeiro elemento visível se nenhum estiver focado', () => {
    const card1 = createMockElement('div', { classes: ['card'] });
    card1.setRect({ left: 50, top: 100, width: 150, height: 220 });
    elements.push(card1);

    const card2 = createMockElement('div', { classes: ['card'] });
    card2.setRect({ left: 220, top: 100, width: 150, height: 220 });
    elements.push(card2);

    const spatNav = new SpatNav({ document: doc, window: win });
    spatNav.init();

    assert.equal(doc.activeElement, card1);
    assert.equal(card1.classList.contains('kflix-focused'), true);
  });

  it('deve navegar corretamente para a direita e para baixo em uma grade 2x2', () => {
    // Linha 1
    const card00 = createMockElement('div', { classes: ['card'] });
    card00.setRect({ left: 100, top: 100, width: 100, height: 100 });
    elements.push(card00);

    const card01 = createMockElement('div', { classes: ['card'] });
    card01.setRect({ left: 250, top: 100, width: 100, height: 100 });
    elements.push(card01);

    // Linha 2
    const card10 = createMockElement('div', { classes: ['card'] });
    card10.setRect({ left: 100, top: 250, width: 100, height: 100 });
    elements.push(card10);

    const card11 = createMockElement('div', { classes: ['card'] });
    card11.setRect({ left: 250, top: 250, width: 100, height: 100 });
    elements.push(card11);

    const spatNav = new SpatNav({ document: doc, window: win });
    spatNav.init();

    // Começa em card00
    assert.equal(doc.activeElement, card00);

    // ArrowRight -> card01
    let prevented = false;
    doc.dispatchEvent({
      type: 'keydown',
      key: 'ArrowRight',
      code: 'ArrowRight',
      preventDefault: () => { prevented = true; }
    });

    assert.equal(doc.activeElement, card01);
    assert.equal(card00.classList.contains('kflix-focused'), false);
    assert.equal(card01.classList.contains('kflix-focused'), true);
    assert.equal(card01.wasScrolled, true);
    assert.equal(prevented, true);

    // ArrowDown -> card11
    doc.dispatchEvent({
      type: 'keydown',
      key: 'ArrowDown',
      code: 'ArrowDown',
      preventDefault: () => {}
    });
    assert.equal(doc.activeElement, card11);

    // ArrowLeft -> card10
    doc.dispatchEvent({
      type: 'keydown',
      key: 'ArrowLeft',
      code: 'ArrowLeft',
      preventDefault: () => {}
    });
    assert.equal(doc.activeElement, card10);

    // ArrowUp -> card00
    doc.dispatchEvent({
      type: 'keydown',
      key: 'ArrowUp',
      code: 'ArrowUp',
      preventDefault: () => {}
    });
    assert.equal(doc.activeElement, card00);
  });

  it('deve acionar click ao pressionar a tecla Enter no elemento com foco', () => {
    let clicked = false;
    const btn = createMockElement('button', {
      classes: ['emby-button'],
      onClick: () => { clicked = true; }
    });
    btn.setRect({ left: 100, top: 100, width: 120, height: 50 });
    elements.push(btn);

    const spatNav = new SpatNav({ document: doc, window: win });
    spatNav.init();

    assert.equal(doc.activeElement, btn);

    doc.dispatchEvent({
      type: 'keydown',
      key: 'Enter',
      code: 'Enter',
      preventDefault: () => {}
    });

    assert.equal(clicked, true);
  });

  it('deve manter o foco atual se não houver elemento na direção solicitada', () => {
    const card = createMockElement('div', { classes: ['card'] });
    card.setRect({ left: 100, top: 100, width: 100, height: 100 });
    elements.push(card);

    const spatNav = new SpatNav({ document: doc, window: win });
    spatNav.init();

    assert.equal(doc.activeElement, card);

    // Tentativa de subir além do topo
    doc.dispatchEvent({
      type: 'keydown',
      key: 'ArrowUp',
      code: 'ArrowUp',
      preventDefault: () => {}
    });

    assert.equal(doc.activeElement, card);
    assert.equal(card.classList.contains('kflix-focused'), true);
  });

  it('deve ignorar elementos com tabindex="-1"', () => {
    const hiddenTab = createMockElement('div', {
      classes: ['card'],
      attributes: { tabindex: '-1' }
    });
    hiddenTab.setRect({ left: 10, top: 10, width: 100, height: 100 });
    elements.push(hiddenTab);

    const normalCard = createMockElement('div', { classes: ['card'] });
    normalCard.setRect({ left: 150, top: 10, width: 100, height: 100 });
    elements.push(normalCard);

    const spatNav = new SpatNav({ document: doc, window: win });
    const focusable = spatNav.getFocusableElements();

    assert.equal(focusable.length, 1);
    assert.equal(focusable[0], normalCard);
  });

  it('deve redirecionar toque/clique no banner para a ação principal do card no Jellyfin', () => {
    const card = createMockElement('div', { classes: ['card'] });
    const cardBox = createMockElement('div', { classes: ['cardBox'] });
    const cardScalable = createMockElement('div', { classes: ['cardScalable'] });
    const banner = createMockElement('div', { classes: ['cardPadder'] });
    const overlay = createMockElement('div', { classes: ['cardOverlayContainer'] });
    const linkButton = createMockElement('button', {
      classes: ['cardContent'],
      attributes: { 'data-action': 'link' }
    });

    card.appendChild(cardBox);
    cardBox.appendChild(cardScalable);
    cardScalable.appendChild(banner);
    cardScalable.appendChild(overlay);
    cardScalable.appendChild(linkButton);

    elements.push(card, cardBox, cardScalable, banner, overlay, linkButton);

    const spatNav = new SpatNav({ document: doc, window: win });
    spatNav.init();

    // Simula toque no banner (cardPadder)
    doc.dispatchEvent({
      type: 'click',
      target: banner
    });

    assert.equal(linkButton.wasClicked, true, 'O botão de link principal deve ser clicado com 1 toque no banner');
  });

  it('não deve interferir se o clique for em botão de ação direta do card (ex: play)', () => {
    const card = createMockElement('div', { classes: ['card'] });
    const linkButton = createMockElement('button', {
      classes: ['cardContent'],
      attributes: { 'data-action': 'link' }
    });
    const playButton = createMockElement('button', {
      classes: ['cardOverlayButton'],
      attributes: { 'data-action': 'play' }
    });

    card.appendChild(linkButton);
    card.appendChild(playButton);

    elements.push(card, linkButton, playButton);

    const spatNav = new SpatNav({ document: doc, window: win });
    spatNav.init();

    // Simula clique no botão de play
    doc.dispatchEvent({
      type: 'click',
      target: playButton
    });

    // O play button recebeu o clique nativo do navegador, o link primário não deve ser forçado
    assert.equal(linkButton.wasClicked, false);
  });

  it('deve navegar atomicamente de card para card ignorando elementos internos do mesmo card', () => {
    // Card 1 com elementos internos (cardBox, banner, título, botão)
    const card1 = createMockElement('div', { classes: ['card'] });
    card1.setRect({ left: 10, top: 10, width: 100, height: 150 });
    const card1Box = createMockElement('div', { classes: ['cardBox'] });
    card1Box.setRect({ left: 10, top: 10, width: 100, height: 150 });
    const card1Btn = createMockElement('button', { classes: ['cardContent'] });
    card1Btn.setRect({ left: 10, top: 10, width: 100, height: 120 });
    const card1Title = createMockElement('a', { classes: ['cardText-first'] });
    card1Title.setRect({ left: 10, top: 130, width: 100, height: 20 });
    card1.appendChild(card1Box);
    card1Box.appendChild(card1Btn);
    card1Box.appendChild(card1Title);

    // Card 2 ao lado
    const card2 = createMockElement('div', { classes: ['card'] });
    card2.setRect({ left: 130, top: 10, width: 100, height: 150 });
    const card2Box = createMockElement('div', { classes: ['cardBox'] });
    card2Box.setRect({ left: 130, top: 10, width: 100, height: 150 });
    const card2Btn = createMockElement('button', { classes: ['cardContent'] });
    card2Btn.setRect({ left: 130, top: 10, width: 100, height: 120 });
    card2.appendChild(card2Box);
    card2Box.appendChild(card2Btn);

    elements.push(card1, card1Box, card1Btn, card1Title, card2, card2Box, card2Btn);

    const spatNav = new SpatNav({ document: doc, window: win });
    spatNav.init();

    const focusables = spatNav.getFocusableElements();
    // A lista filtrada deve conter APENAS os 2 cards raiz
    assert.equal(focusables.length, 2, 'Deve conter apenas os cards principais');
    assert.equal(focusables[0], card1);
    assert.equal(focusables[1], card2);

    // O foco inicial está em card1
    assert.equal(doc.activeElement, card1);

    // Pressionar seta para a direita deve pular DIRETO para card2, sem passar pelo título ou botão de card1
    doc.dispatchEvent({
      type: 'keydown',
      key: 'ArrowRight',
      code: 'ArrowRight',
      preventDefault: () => {}
    });

    assert.equal(doc.activeElement, card2, 'Deve pular de banner para banner (card1 -> card2)');
  });
});
