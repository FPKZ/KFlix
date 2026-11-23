/**
 * KFlix Player Controller (kflix-player.js)
 * Controlador de reprodução de mídia para Smart TVs (Fire TV / Tizen / Android TV).
 * Mapeia eventos de mídia do controle remoto (Play, Pause, Seek, Back/Escape) para o player de vídeo do Jellyfin.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KFlixPlayer = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const BACK_BUTTON_SELECTORS = [
    '.btnBack',
    'button[data-action="back"]',
    '.headerBackButton',
    'button.headerButton-back',
    '.videoOsdBackButton',
    'button.btnVideoOsdBack'
  ].join(', ');

  class KFlixPlayer {
    constructor(options = {}) {
      this.doc = options.document || (typeof document !== 'undefined' ? document : null);
      this.win = options.window || (typeof window !== 'undefined' ? window : null);
      this.seekStepSeconds = options.seekStepSeconds || 10;
      this.handleKeyDown = this.handleKeyDown.bind(this);
      this._initialized = false;
    }

    init() {
      if (!this.doc || this._initialized) return;
      this._initialized = true;
      this.doc.addEventListener('keydown', this.handleKeyDown, true);
    }

    destroy() {
      if (!this._initialized || !this.doc) return;
      this.doc.removeEventListener('keydown', this.handleKeyDown, true);
      this._initialized = false;
    }

    getActiveVideo() {
      if (!this.doc) return null;
      const videos = this.doc.querySelectorAll('video');
      if (!videos || videos.length === 0) return null;

      // Se houver mais de um, prefere o que estiver reproduzindo ou visível
      for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        if (v && !v.paused) return v;
      }
      return videos[0];
    }

    isVideoActive() {
      const video = this.getActiveVideo();
      if (!video) return false;
      // Considera ativo se estiver visível ou reproduzindo
      return true;
    }

    togglePlayPause(video) {
      if (!video) video = this.getActiveVideo();
      if (!video) return;

      if (video.paused) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      } else {
        video.pause();
      }
    }

    seek(seconds, video) {
      if (!video) video = this.getActiveVideo();
      if (!video) return;

      const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
      let targetTime = (video.currentTime || 0) + seconds;

      if (targetTime < 0) targetTime = 0;
      if (targetTime > duration) targetTime = duration;

      video.currentTime = targetTime;
    }

    handleBack(video) {
      if (video) {
        try {
          video.pause();
        } catch {}
      }

      // Procura botão de voltar na interface do Jellyfin
      const backBtn = this.doc ? this.doc.querySelector(BACK_BUTTON_SELECTORS) : null;
      if (backBtn && typeof backBtn.click === 'function') {
        backBtn.click();
        return;
      }

      // Fallback para histórico do navegador / WebView
      if (this.win && this.win.history && typeof this.win.history.back === 'function') {
        this.win.history.back();
      }
    }

    handleKeyDown(event) {
      const key = event.key || event.code;
      const keyCode = event.keyCode;
      const video = this.getActiveVideo();

      if (!video) return;

      // 1. Play / Pause
      if (
        key === 'MediaPlayPause' ||
        key === 'MediaPlay' ||
        key === 'MediaPause' ||
        keyCode === 179 || // DOM_VK_MEDIA_PLAY_PAUSE
        keyCode === 19 || // Pause
        (key === ' ' && this.doc && this.doc.activeElement && this.doc.activeElement.tagName === 'BODY')
      ) {
        this.togglePlayPause(video);
        if (typeof event.preventDefault === 'function') event.preventDefault();
        return;
      }

      // 2. Seek Forward (Avanço de 10s)
      if (
        key === 'MediaFastForward' ||
        key === 'MediaTrackNext' ||
        keyCode === 228 || // Fast Forward
        (key === 'ArrowRight' && (video && !video.paused))
      ) {
        this.seek(this.seekStepSeconds, video);
        if (typeof event.preventDefault === 'function') event.preventDefault();
        return;
      }

      // 3. Seek Backward (Retrocesso de 10s)
      if (
        key === 'MediaRewind' ||
        key === 'MediaTrackPrevious' ||
        keyCode === 227 || // Rewind
        (key === 'ArrowLeft' && (video && !video.paused))
      ) {
        this.seek(-this.seekStepSeconds, video);
        if (typeof event.preventDefault === 'function') event.preventDefault();
        return;
      }

      // 4. Fechamento e Saída do Player (Back / Escape / Tizen Return 10009)
      if (
        key === 'Escape' ||
        key === 'Back' ||
        key === 'GoBack' ||
        keyCode === 27 ||
        keyCode === 10009 || // Samsung Tizen Return
        keyCode === 4 // Android Keycode Back
      ) {
        this.handleBack(video);
        if (typeof event.preventDefault === 'function') event.preventDefault();
      }
    }
  }

  // Auto-iniciar apenas em ambiente de navegador direto (não em testes Node/CommonJS)
  if (typeof module === 'undefined' && typeof window !== 'undefined' && typeof document !== 'undefined') {
    const startPlayer = () => {
      if (!window.__kflixPlayerInstance) {
        window.__kflixPlayerInstance = new KFlixPlayer({ document, window });
        window.__kflixPlayerInstance.init();
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startPlayer);
    } else {
      startPlayer();
    }
  }

  return KFlixPlayer;
});
