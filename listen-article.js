/**
 * Lightweight controller that turns the content inside #body-content
 * into an audible article. It listens for clicks on .icon_play inside
 * .listen_article, feeds the full text to the Web Speech API and
 * mirrors progress inside .active_bar.
 *
 * Usage:
 * 1. Wrap the play UI with the provided .listen_article markup.
 * 2. Keep the article text inside #body-content (text, headings, etc.).
 * 3. Load this file with <script src="/path/listen-article.js" defer></script>.
 * 4. Optional: set data-default-label on .base_txt to override the idle label.
 */
(function () {
  const onReady = (callback) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  };

  onReady(() => {
    const article = document.querySelector('#body-content');
    const listenWrapper = document.querySelector('.listen_article');
    const playButton = listenWrapper?.querySelector('.icon_play');
    const statusText = listenWrapper?.querySelector('.listen_stop_article .base_txt');
    const progressBar = listenWrapper?.querySelector('.active_bar');
    const synth = window.speechSynthesis;

    if (!article || !playButton || !progressBar) {
      console.warn('[Listen Article] Missing required DOM nodes.');
      return;
    }

    if (!synth) {
      console.warn('[Listen Article] Speech Synthesis API is not supported in this browser.');
      if (statusText) {
        statusText.textContent = 'Прослушивание недоступно';
      }
      playButton.setAttribute('aria-disabled', 'true');
      return;
    }

    let utterance = null;
    let articleText = '';
    let textLength = 0;
    let isPlaying = false;
    let usingBoundary = false;
    let fallbackTimer = null;
    let fallbackDuration = 0;
    let fallbackStart = 0;

    const DEFAULT_LABEL = statusText?.dataset.defaultLabel || 'Listen Article';

    const updateBar = (ratio) => {
      const clamped = Math.min(Math.max(ratio, 0), 1);
      progressBar.style.width = `${(clamped * 100).toFixed(2)}%`;
    };

    const resetBar = () => {
      updateBar(0);
    };

    const clearFallbackTimer = () => {
      if (fallbackTimer) {
        window.clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const startFallback = () => {
      if (!fallbackDuration) return;
      fallbackStart = performance.now();
      clearFallbackTimer();
      fallbackTimer = window.setInterval(() => {
        const elapsed = performance.now() - fallbackStart;
        const ratio = Math.min(elapsed / fallbackDuration, 1);
        updateBar(ratio);
        if (ratio >= 1) {
          clearFallbackTimer();
        }
      }, 120);
    };

    const estimateDuration = (text) => {
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      const wordsPerMinute = 160;
      return (words / wordsPerMinute) * 60 * 1000;
    };

    const finalizePlayback = (completed) => {
      clearFallbackTimer();
      playButton.classList.remove('is-playing');
      listenWrapper?.classList.remove('is-playing');
      playButton.setAttribute('aria-pressed', 'false');

      if (statusText) {
        statusText.textContent = completed ? 'Готово' : DEFAULT_LABEL;
        window.setTimeout(() => {
          statusText.textContent = DEFAULT_LABEL;
        }, completed ? 1800 : 0);
      }

      if (completed) {
        updateBar(1);
        window.setTimeout(resetBar, 600);
      } else {
        resetBar();
      }

      utterance = null;
      usingBoundary = false;
      isPlaying = false;
      articleText = '';
      textLength = 0;
    };

    const handleBoundary = (event) => {
      usingBoundary = true;
      clearFallbackTimer();
      if (!textLength) return;
      const ratio = Math.min(event.charIndex / textLength, 1);
      updateBar(ratio);
    };

    const createUtterance = () => {
      articleText = article.innerText.replace(/\s+/g, ' ').trim();

      if (!articleText) {
        if (statusText) {
          statusText.textContent = 'Нет текста для чтения';
        }
        return null;
      }

      textLength = articleText.length;
      const u = new SpeechSynthesisUtterance(articleText);
      u.lang = article.getAttribute('lang') || document.documentElement.lang || 'ru-RU';
      u.rate = 1;
      u.pitch = 1;
      u.onend = () => finalizePlayback(true);
      u.onerror = () => finalizePlayback(false);
      u.onboundary = handleBoundary;
      return u;
    };

    const startPlayback = () => {
      utterance = createUtterance();
      if (!utterance) return;

      fallbackDuration = estimateDuration(articleText);
      usingBoundary = false;
      synth.cancel(); // Stop any ongoing speech tasks before starting ours.

      // Visual state
      isPlaying = true;
      playButton.classList.add('is-playing');
      listenWrapper?.classList.add('is-playing');
      playButton.setAttribute('aria-pressed', 'true');
      if (statusText) statusText.textContent = 'Слушаем...';
      resetBar();

      synth.speak(utterance);

      // Use fallback timer only when boundary events are not fired.
      window.setTimeout(() => {
        if (!usingBoundary) {
          startFallback();
        }
      }, 450);
    };

    const stopPlayback = () => {
      if (!isPlaying) return;

      if (utterance) {
        utterance.onend = null;
        utterance.onerror = null;
        utterance.onboundary = null;
      }

      synth.cancel();
      finalizePlayback(false);
    };

    playButton.setAttribute('role', 'button');
    playButton.setAttribute('tabindex', '0');

    const togglePlayback = () => {
      if (isPlaying) {
        stopPlayback();
      } else {
        startPlayback();
      }
    };

    playButton.addEventListener('click', togglePlayback);
    playButton.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        togglePlayback();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopPlayback();
      }
    });
  });
})();
