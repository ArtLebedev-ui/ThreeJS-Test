(function () {
  const VIDEO_SELECTOR = '.slider_wrap .video_testimonial';
  const PLAYING_CLASS = 'is-hover-playing';
  const playedVideos = new WeakSet();
  const processedVideos = new WeakSet();
  const prefersReducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false, addEventListener: function noop() {} };

  const loadVideoSource = (video) => {
    if (video.dataset.src && (!video.dataset.loaded || video.dataset.loaded === 'false')) {
      video.src = video.dataset.src;
      video.dataset.loaded = 'true';
    }
    if (video.readyState === 0) {
      video.load();
    }
  };

  const playVideo = (video) => {
    loadVideoSource(video);
    playedVideos.add(video);
    video.classList.add(PLAYING_CLASS);

    const playPromise = video.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch(() => {
        // Ignore autoplay blocking errors; user interaction will retrigger play.
      });
    }
  };

  const resetVideo = (video, { force = false } = {}) => {
    if (!force && !playedVideos.has(video)) {
      return;
    }

    video.pause();
    video.currentTime = 0;
    video.classList.remove(PLAYING_CLASS);
    video.dataset.touchPlaying = 'false';
    playedVideos.delete(video);
  };

  const stopOtherVideos = (currentVideo, getVideos) => {
    getVideos().forEach((video) => {
      if (video !== currentVideo) {
        resetVideo(video);
      }
    });
  };

  const createIntersectionGuard = () => {
    if (!('IntersectionObserver' in window)) {
      return null;
    }

    return new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) {
            resetVideo(target);
          }
        });
      },
      { threshold: 0.4 }
    );
  };

  const enhanceVideo = (video, getVideos, intersectionObserver) => {
    if (processedVideos.has(video)) {
      return;
    }
    processedVideos.add(video);

    video.removeAttribute('autoplay');
    video.autoplay = false;
    resetVideo(video, { force: true });

    intersectionObserver?.observe(video);

    const handlePointerEnter = (event) => {
      if (prefersReducedMotion.matches || event.pointerType === 'touch') {
        return;
      }
      stopOtherVideos(video, getVideos);
      playVideo(video);
    };

    const handlePointerLeave = (event) => {
      if (event.pointerType === 'touch') {
        return;
      }
      resetVideo(video);
    };

    const handleFocus = () => {
      if (prefersReducedMotion.matches) {
        return;
      }
      stopOtherVideos(video, getVideos);
      playVideo(video);
    };

    const handleBlur = () => {
      resetVideo(video);
    };

    const handleTap = () => {
      const isPlaying = video.dataset.touchPlaying === 'true';
      if (isPlaying) {
        resetVideo(video);
      } else {
        stopOtherVideos(video, getVideos);
        playVideo(video);
        video.dataset.touchPlaying = 'true';
      }
    };

    video.addEventListener('pointerenter', handlePointerEnter);
    video.addEventListener('pointerleave', handlePointerLeave);
    video.addEventListener('focus', handleFocus);
    video.addEventListener('blur', handleBlur);
    video.addEventListener('click', handleTap);
  };

  const init = () => {
    const getVideos = () => Array.from(document.querySelectorAll(VIDEO_SELECTOR));
    const intersectionObserver = createIntersectionGuard();
    const videos = getVideos();

    if (!videos.length) {
      return;
    }

    videos.forEach((video) => enhanceVideo(video, getVideos, intersectionObserver));

    const sliderWrap = document.querySelector('.slider_wrap');
    let mutationObserver = null;
    if (sliderWrap) {
      mutationObserver = new MutationObserver(() => {
        getVideos().forEach((video) => enhanceVideo(video, getVideos, intersectionObserver));
      });

      mutationObserver.observe(sliderWrap, { childList: true, subtree: true });
    }

    prefersReducedMotion.addEventListener?.('change', ({ matches }) => {
      if (matches) {
        getVideos().forEach(resetVideo);
      }
    });

    window.addEventListener('pagehide', () => {
      getVideos().forEach(resetVideo);
    });

    // Expose a quick cleanup hook if needed by other scripts.
    window.teardownTestimonialVideoHover = () => {
      intersectionObserver?.disconnect();
      mutationObserver?.disconnect();
      getVideos().forEach((video) => {
        video.replaceWith(video.cloneNode(true));
      });
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
