/**
 * KFlix Spatial Navigation (kflix-spatnav.js)
 * Motor de navegação espacial D-Pad para Smart TVs (Fire TV / Tizen / Android TV).
 * Desenvolvido especificamente para a interface Web do Jellyfin.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KFlixSpatNav = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_SELECTOR = [
    '.card',
    '.listItem',
    'button',
    'a',
    '.emby-button',
    '.paper-icon-button-light',
    '.cardBox',
    '.visualCardBox',
    'input',
    'select',
    'textarea',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  class KFlixSpatNav {
    constructor(options = {}) {
      this.doc = options.document || (typeof document !== 'undefined' ? document : null);
      this.win = options.window || (typeof window !== 'undefined' ? window : null);
      this.selector = options.selector || DEFAULT_SELECTOR;
      this.focusedClass = options.focusedClass || 'kflix-focused';
      this.handleKeyDown = this.handleKeyDown.bind(this);
      this.handleCardClick = this.handleCardClick.bind(this);
      this.handleFocusIn = this.handleFocusIn.bind(this);
      this._initialized = false;
    }

    init() {
      if (!this.doc || this._initialized) return;
      this._initialized = true;

      this.doc.addEventListener('keydown', this.handleKeyDown, true);
      this.doc.addEventListener('click', this.handleCardClick, true);
      this.doc.addEventListener('focusin', this.handleFocusIn, true);

      // Auto-foco inicial se nada estiver focado
      this.focusFirstElement();

      // Observador de mutações para focar quando SPA Jellyfin renderizar views dinâmicas
      if (this.win && typeof this.win.MutationObserver === 'function') {
        this.observer = new this.win.MutationObserver(() => {
          if (!this.getCurrentFocused()) {
            this.focusFirstElement();
          }
        });
        if (this.doc.body) {
          this.observer.observe(this.doc.body, { childList: true, subtree: true });
        }
      }
    }

    destroy() {
      if (!this._initialized || !this.doc) return;
      this.doc.removeEventListener('keydown', this.handleKeyDown, true);
      this.doc.removeEventListener('click', this.handleCardClick, true);
      this.doc.removeEventListener('focusin', this.handleFocusIn, true);
      if (this.observer) {
        this.observer.disconnect();
      }
      this._initialized = false;
    }

    /**
     * Sincronização Unificada de Foco:
     * Quando qualquer elemento do Jellyfin ganha foco (seja pelo nosso D-Pad
     * ou pelo próprio controle nativo do Jellyfin em modo TV), removemos
     * qualquer foco duplicado anterior e executamos a rolagem centralizada suave.
     */
    handleFocusIn(event) {
      if (!event || !event.target) return;
      const target = event.target;

      // Limpa classe de foco de nós antigos para evitar foco duplo na tela
      const allFocused = this.doc.querySelectorAll ? this.doc.querySelectorAll('.' + this.focusedClass) : [];
      if (allFocused && allFocused.forEach) {
        allFocused.forEach(node => {
          if (node !== target && node.classList && node.classList.remove) {
            node.classList.remove(this.focusedClass);
          }
        });
      }

      // Adiciona nossa classe de destaque ao card ativo
      const card = (typeof target.closest === 'function') ? target.closest('.card, .listItem') : null;
      const activeNode = card || target;
      if (activeNode.classList && activeNode.classList.add) {
        activeNode.classList.add(this.focusedClass);
      }

      this.smoothCenterScroll(activeNode);
    }

    /**
     * Auto-Scroll Centralizado Inteligente:
     * Mantém o card focado sempre no terço central visível da tela da TV,
     * garantindo que listas verticais longas e carrosséis horizontais rolem suavemente.
     */
    smoothCenterScroll(el) {
      if (!el) return;

      if (typeof el.scrollIntoView === 'function') {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        } catch {
          try {
            el.scrollIntoView(false);
          } catch {}
        }
      }

      // Suporte para carrosséis horizontais do Jellyfin (.itemsContainer, emby-scroller)
      if (typeof el.closest === 'function') {
        const scroller = el.closest('.itemsContainer, emby-scroller, .focuscontainer-x, [data-horizontal="true"]');
        if (scroller && typeof scroller.getBoundingClientRect === 'function' && typeof el.getBoundingClientRect === 'function') {
          const scrollerRect = scroller.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const deltaX = (elRect.left - scrollerRect.left) - (scrollerRect.width / 2) + (elRect.width / 2);
          if (Math.abs(deltaX) > 20) {
            const newLeft = (scroller.scrollLeft || 0) + deltaX;
            if (typeof scroller.scrollTo === 'function') {
              try {
                scroller.scrollTo({ left: newLeft, behavior: 'smooth' });
              } catch {
                scroller.scrollLeft = newLeft;
              }
            } else {
              scroller.scrollLeft = newLeft;
            }
          }
        }
      }
    }

    /**
     * Garante que toques ou cliques em qualquer área do banner/pôster
     * (mesmo em áreas cobertas por overlays ou wrappers decorativos do Jellyfin)
     * acionem a ação principal do card de filme/série com 1 único toque.
     */
    handleCardClick(event) {
      if (!event || !event.target) return;
      const target = event.target;

      // Se clicou diretamente em um botão de ação secundária (como Play direto, Menu 3-pontos, etc.),
      // deixa o evento seguir normalmente
      if (typeof target.closest === 'function') {
        const actionButton = target.closest('[data-action="play"], [data-action="menu"], [data-action="custom"], .cardOverlayButton');
        if (actionButton) {
          return;
        }
      }

      // Localiza o card pai
      const card = (typeof target.closest === 'function') ? target.closest('.card, .cardBox') : null;
      if (!card) return;

      // Se já clicou no próprio gatilho primário (ex: o link <a> do título), deixa seguir
      if (typeof target.closest === 'function') {
        const directLink = target.closest('[data-action="link"], a.cardText-first');
        if (directLink) {
          return;
        }
      }

      // Encontra a ação primária do card (link de detalhes ou botão de conteúdo)
      const primaryAction = card.querySelector ? (
        card.querySelector('[data-action="link"]') ||
        card.querySelector('a.cardText-first') ||
        card.querySelector('button.cardContent') ||
        card.querySelector('.cardText-first a') ||
        card.querySelector('a[href]')
      ) : null;

      if (primaryAction && primaryAction !== target && typeof primaryAction.click === 'function') {
        primaryAction.click();
      }
    }

    getFocusableElements() {
      if (!this.doc) return [];
      const rawNodes = Array.from(this.doc.querySelectorAll(this.selector));
      const visibleNodes = rawNodes.filter(el => this.isVisible(el));

      // Garante navegação atômica (de banner em banner / card em card):
      // Se um elemento estiver contido dentro de um .card ou .listItem que também
      // é um alvo de foco, nós descartamos os nós internos (como botões de overlay,
      // títulos ou wrappers internos) para que as setas pulem direto de card para card!
      return visibleNodes.filter(node => {
        // Se o próprio nó é um card principal (.card ou .listItem), ele é mantido
        if (typeof node.matches === 'function' && (node.matches('.card') || node.matches('.listItem'))) {
          return true;
        }

        // Se for um container secundário de card (.cardBox ou .visualCardBox) dentro de um .card pai, descarta
        if (typeof node.matches === 'function' && node.matches('.cardBox, .visualCardBox')) {
          if (node.parentElement && typeof node.parentElement.closest === 'function') {
            const outerCard = node.parentElement.closest('.card, .listItem');
            if (outerCard && visibleNodes.includes(outerCard)) {
              return false;
            }
          }
          return true;
        }

        // Se o nó é um botão, link ou outro elemento DENTRO de um .card ou .listItem existente,
        // descarta para que a seta pule para o próximo card inteiro em vez de navegar pelos detalhes do mesmo banner
        if (node.parentElement && typeof node.parentElement.closest === 'function') {
          const parentCard = node.parentElement.closest('.card, .listItem, .cardBox');
          if (parentCard && visibleNodes.includes(parentCard)) {
            return false;
          }
        }

        return true;
      });
    }

    isVisible(el) {
      if (!el) return false;
      if (typeof el.getAttribute === 'function' && el.getAttribute('tabindex') === '-1' && !el.hasAttribute('data-kflix-managed')) {
        return false;
      }
      if (el.style) {
        if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;
      }
      if (typeof el.getBoundingClientRect !== 'function') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    getCurrentFocused() {
      if (!this.doc) return null;
      const active = this.doc.activeElement;
      if (!active || active === this.doc.body || !this.isVisible(active)) {
        return null;
      }
      return active;
    }

    focusElement(el) {
      if (!el) return false;

      // Remove foco de elementos anteriores
      const allFocused = this.doc.querySelectorAll ? this.doc.querySelectorAll('.' + this.focusedClass) : [];
      if (allFocused && allFocused.forEach) {
        allFocused.forEach(node => {
          if (node.classList && node.classList.remove) {
            node.classList.remove(this.focusedClass);
          }
        });
      }

      if (el.classList && el.classList.add) {
        el.classList.add(this.focusedClass);
      }

      if (typeof el.setAttribute === 'function' && !el.hasAttribute('tabindex')) {
        el.setAttribute('tabindex', '-1');
        el.setAttribute('data-kflix-managed', 'true');
      }

      if (typeof el.focus === 'function') {
        el.focus();
      }

      this.smoothCenterScroll(el);

      return true;
    }

    focusFirstElement() {
      const candidates = this.getFocusableElements();
      if (candidates.length > 0) {
        this.focusElement(candidates[0]);
        return true;
      }
      return false;
    }

    getCenter(rect) {
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    }

    findNextElement(currentEl, direction) {
      const candidates = this.getFocusableElements().filter(el => el !== currentEl);
      if (candidates.length === 0) return null;

      const currentRect = currentEl.getBoundingClientRect();
      const currentCenter = this.getCenter(currentRect);

      let bestCandidate = null;
      let minDistance = Infinity;

      for (const candidate of candidates) {
        const candidateRect = candidate.getBoundingClientRect();
        const candidateCenter = this.getCenter(candidateRect);

        let isTargetDirection = false;
        let dPrimary = 0;
        let dOrtho = 0;
        let overlap = false;

        switch (direction) {
          case 'ArrowRight':
            isTargetDirection = candidateCenter.x > currentCenter.x + 2 || candidateRect.left >= currentRect.left + 5;
            dPrimary = candidateRect.left - currentRect.right;
            if (dPrimary < 0) dPrimary = candidateCenter.x - currentCenter.x;
            dOrtho = Math.abs(candidateCenter.y - currentCenter.y);
            overlap = candidateRect.top < currentRect.bottom && candidateRect.bottom > currentRect.top;
            break;

          case 'ArrowLeft':
            isTargetDirection = candidateCenter.x < currentCenter.x - 2 || candidateRect.right <= currentRect.right - 5;
            dPrimary = currentRect.left - candidateRect.right;
            if (dPrimary < 0) dPrimary = currentCenter.x - candidateCenter.x;
            dOrtho = Math.abs(candidateCenter.y - currentCenter.y);
            overlap = candidateRect.top < currentRect.bottom && candidateRect.bottom > currentRect.top;
            break;

          case 'ArrowDown':
            isTargetDirection = candidateCenter.y > currentCenter.y + 2 || candidateRect.top >= currentRect.top + 5;
            dPrimary = candidateRect.top - currentRect.bottom;
            if (dPrimary < 0) dPrimary = candidateCenter.y - currentCenter.y;
            dOrtho = Math.abs(candidateCenter.x - currentCenter.x);
            overlap = candidateRect.left < currentRect.right && candidateRect.right > currentRect.left;
            break;

          case 'ArrowUp':
            isTargetDirection = candidateCenter.y < currentCenter.y - 2 || candidateRect.bottom <= currentRect.bottom - 5;
            dPrimary = currentRect.top - candidateRect.bottom;
            if (dPrimary < 0) dPrimary = currentCenter.y - candidateCenter.y;
            dOrtho = Math.abs(candidateCenter.x - currentCenter.x);
            overlap = candidateRect.left < currentRect.right && candidateRect.right > currentRect.left;
            break;
        }

        if (isTargetDirection && dPrimary >= -20) {
          // Ponderação espacial: favorece alinhamento na mesma linha/coluna
          const orthoWeight = overlap ? 1.2 : 3.0;
          const distance = Math.max(0, dPrimary) + (dOrtho * orthoWeight);

          if (distance < minDistance) {
            minDistance = distance;
            bestCandidate = candidate;
          }
        }
      }

      // Se não encontrou candidato na direção e foi pressionado Seta Esquerda (borda da tela)
      if (!bestCandidate && direction === 'ArrowLeft') {
        const drawerBtn = this.doc.querySelector ? (
          this.doc.querySelector('.mainDrawerButton, button.mainDrawer-button, [data-action="menu"], .btnMenu')
        ) : null;
        if (drawerBtn && this.isVisible(drawerBtn) && drawerBtn !== currentEl) {
          return drawerBtn;
        }
      }

      // Se estiver dentro do menu lateral e pressionar Seta Direita, volta para os cards
      if (!bestCandidate && direction === 'ArrowRight') {
        const inDrawer = typeof currentEl.closest === 'function' && currentEl.closest('.mainDrawer, nav, aside');
        if (inDrawer) {
          const firstContent = this.doc.querySelector ? this.doc.querySelector('.card, .itemsContainer a, .itemsContainer button') : null;
          if (firstContent && this.isVisible(firstContent)) {
            return firstContent;
          }
        }
      }

      return bestCandidate;
    }

    handleKeyDown(event) {
      // Se o Modo Mouse Virtual estiver ativo, desativa o SpatNav para não competir
      if (this.win && this.win.__kflixMouseMode) {
        return;
      }

      const key = event.key || event.code;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        let current = this.getCurrentFocused();
        if (!current) {
          if (this.focusFirstElement()) {
            if (typeof event.preventDefault === 'function') event.preventDefault();
          }
          return;
        }

        const next = this.findNextElement(current, key);
        if (next) {
          this.focusElement(next);
          if (typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
        }
      } else if (key === 'Enter' || key === 'Select') {
        const current = this.getCurrentFocused();
        if (current && typeof current.click === 'function') {
          // Se for input de texto, não cancela comportamento nativo
          if (current.tagName !== 'INPUT' && current.tagName !== 'TEXTAREA') {
            current.click();
          }
        }
      }
    }
  }

  // Auto-iniciar apenas em ambiente de navegador direto (não em testes Node/CommonJS)
  if (typeof module === 'undefined' && typeof window !== 'undefined' && typeof document !== 'undefined') {
    const startSpatNav = () => {
      if (!window.__kflixSpatNavInstance) {
        window.__kflixSpatNavInstance = new KFlixSpatNav({ document, window });
        window.__kflixSpatNavInstance.init();
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startSpatNav);
    } else {
      startSpatNav();
    }
  }

  return KFlixSpatNav;
});
