/**
 * KFlix Virtual Mouse (kflix-virtual-mouse.js)
 * Modo ponteiro de mouse virtual para Smart TVs.
 * Permite controlar um cursor na tela com aceleração no D-Pad, clique no OK
 * e rolagem automática nas bordas da tela.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KFlixVirtualMouse = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  class KFlixVirtualMouse {
    constructor(options = {}) {
      this.doc = options.document || (typeof document !== 'undefined' ? document : null);
      this.win = options.window || (typeof window !== 'undefined' ? window : null);
      this.isEnabled = false;
      this.x = 200;
      this.y = 200;
      this.cursorEl = null;
      this.toastEl = null;
      this.lastMenuPressTime = 0;
      this.activeKeys = new Set();

      this.handleKeyDown = this.handleKeyDown.bind(this);
      this.handleKeyUp = this.handleKeyUp.bind(this);
    }

    init() {
      if (!this.doc || !this.win) return;
      this.win.addEventListener('keydown', this.handleKeyDown, true);
      this.win.addEventListener('keyup', this.handleKeyUp, true);
    }

    destroy() {
      if (!this.win) return;
      this.win.removeEventListener('keydown', this.handleKeyDown, true);
      this.win.removeEventListener('keyup', this.handleKeyUp, true);
      if (this.cursorEl && this.cursorEl.parentNode) {
        this.cursorEl.parentNode.removeChild(this.cursorEl);
      }
      if (this.toastEl && this.toastEl.parentNode) {
        this.toastEl.parentNode.removeChild(this.toastEl);
      }
      this.cursorEl = null;
      this.toastEl = null;
    }

    toggle() {
      this.isEnabled = !this.isEnabled;
      if (this.win) {
        this.win.__kflixMouseMode = this.isEnabled;
      }
      if (this.isEnabled) {
        this.ensureElements();
        if (this.cursorEl) this.cursorEl.style.display = 'block';
        this.showToast('🖱️ Modo Mouse Ativado');
      } else {
        if (this.cursorEl) this.cursorEl.style.display = 'none';
        this.showToast('📺 Modo TV D-Pad Ativado');
      }
      return this.isEnabled;
    }

    ensureElements() {
      if (!this.doc || !this.doc.body) return;
      if (!this.cursorEl) {
        this.cursorEl = this.doc.createElement('div');
        this.cursorEl.id = 'kflix-virtual-cursor';
        this.doc.body.appendChild(this.cursorEl);
        var winW = (this.win && this.win.innerWidth) ? this.win.innerWidth : 800;
        var winH = (this.win && this.win.innerHeight) ? this.win.innerHeight : 600;
        this.x = Math.round(winW / 2);
        this.y = Math.round(winH / 2);
        this.updateCursorPosition();
      }
      if (!this.toastEl) {
        this.toastEl = this.doc.createElement('div');
        this.toastEl.id = 'kflix-mode-toast';
        this.doc.body.appendChild(this.toastEl);
      }
    }

    showToast(message) {
      this.ensureElements();
      if (!this.toastEl) return;
      this.toastEl.textContent = message;
      if (this.toastEl.classList && this.toastEl.classList.add) {
        this.toastEl.classList.add('visible');
      }
      setTimeout(() => {
        if (this.toastEl && this.toastEl.classList && this.toastEl.classList.remove) {
          this.toastEl.classList.remove('visible');
        }
      }, 2000);
    }

    updateCursorPosition() {
      if (!this.cursorEl || !this.cursorEl.style) return;
      this.cursorEl.style.left = this.x + 'px';
      this.cursorEl.style.top = this.y + 'px';
    }

    handleKeyDown(event) {
      if (!event) return;
      const key = event.key || event.code;

      // Pressionar Menu duas vezes em menos de 600ms alterna entre D-Pad e Mouse Virtual
      if (key === 'Menu' || key === 'ContextMenu' || event.keyCode === 82 || event.keyCode === 10133) {
        const now = Date.now();
        if (now - this.lastMenuPressTime < 600) {
          this.toggle();
          if (typeof event.preventDefault === 'function') event.preventDefault();
          this.lastMenuPressTime = 0;
          return;
        }
        this.lastMenuPressTime = now;
      }

      if (!this.isEnabled) return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        this.activeKeys.add(key);

        const step = event.repeat ? 24 : 12;
        var maxH = (this.win && this.win.innerHeight) ? this.win.innerHeight : 600;
        var maxW = (this.win && this.win.innerWidth) ? this.win.innerWidth : 800;
        if (key === 'ArrowUp') this.y = Math.max(10, this.y - step);
        if (key === 'ArrowDown') this.y = Math.min(maxH - 10, this.y + step);
        if (key === 'ArrowLeft') this.x = Math.max(10, this.x - step);
        if (key === 'ArrowRight') this.x = Math.min(maxW - 10, this.x + step);

        this.updateCursorPosition();

        // Rolagem suave automática ao aproximar das bordas da tela
        const edgeThreshold = 60;
        if (this.y < edgeThreshold) {
          if (this.win && typeof this.win.scrollBy === 'function') {
            this.win.scrollBy({ top: -50, behavior: 'smooth' });
          }
        } else if (this.y > maxH - edgeThreshold) {
          if (this.win && typeof this.win.scrollBy === 'function') {
            this.win.scrollBy({ top: 50, behavior: 'smooth' });
          }
        }

      } else if (key === 'Enter' || key === 'Select') {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        this.performClick();
      }
    }

    handleKeyUp(event) {
      if (!event) return;
      const key = event.key || event.code;
      this.activeKeys.delete(key);
    }

    performClick() {
      if (!this.doc) return;
      if (this.cursorEl && this.cursorEl.classList) {
        this.cursorEl.classList.add('clicking');
        setTimeout(() => {
          if (this.cursorEl && this.cursorEl.classList) {
            this.cursorEl.classList.remove('clicking');
          }
        }, 120);
      }

      const target = (typeof this.doc.elementFromPoint === 'function')
        ? this.doc.elementFromPoint(this.x, this.y)
        : null;

      if (target) {
        if (typeof target.click === 'function') {
          target.click();
        }
        if (typeof target.focus === 'function') {
          target.focus();
        }
      }
    }
  }

  // Auto-iniciar em ambiente de navegador
  if (typeof module === 'undefined' && typeof window !== 'undefined' && typeof document !== 'undefined') {
    const startMouse = () => {
      if (!window.__kflixVirtualMouseInstance) {
        window.__kflixVirtualMouseInstance = new KFlixVirtualMouse({ document, window });
        window.__kflixVirtualMouseInstance.init();
        window.KFlixToggleMouseMode = () => window.__kflixVirtualMouseInstance.toggle();
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startMouse);
    } else {
      startMouse();
    }
  }

  return KFlixVirtualMouse;
});
