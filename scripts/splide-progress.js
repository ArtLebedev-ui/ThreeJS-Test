(function () {
  const SLIDER_SELECTOR = '.slider1';
  const PROGRESS_BAR_SELECTOR = '.my-slider-progress-bar';

  const defaultOptions = {
    perPage: 3.5,
    perMove: 1,
    focus: 0,
    type: 'slide',
    gap: '12px',
    arrows: 'slider',
    pagination: 'slider',
    speed: 800,
    dragAngleThreshold: 60,
    autoWidth: false,
    rewind: false,
    rewindSpeed: 400,
    waitForTransition: false,
    updateOnMove: true,
    trimSpace: false,
    breakpoints: {
      991: {
        perPage: 2,
        gap: '12px',
      },
      767: {
        perPage: 1,
        gap: '8px',
      },
      479: {
        perPage: 1,
        gap: '8px',
      },
    },
  };

  const getProgressBar = (sliderEl) => {
    const wrap = sliderEl.closest('.slider_wrap');
    if (!wrap) {
      return null;
    }
    return wrap.querySelector(PROGRESS_BAR_SELECTOR);
  };

  const createProgressUpdater = (splide, progressBar) => {
    if (!progressBar) {
      return () => {};
    }

    const controller = splide.Components.Controller;

    return () => {
      const end = controller.getEnd();
      if (end <= 0) {
        progressBar.style.width = '100%';
        return;
      }
      const index = controller.getIndex();
      const width = Math.min(Math.max(index / end, 0), 1) * 100;
      progressBar.style.width = `${width}%`;
    };
  };

  const initSlider = (sliderEl) => {
    const splide = new Splide(sliderEl, defaultOptions);
    const progressBar = getProgressBar(sliderEl);
    const updateProgress = createProgressUpdater(splide, progressBar);

    splide.on('mounted move resize updated', updateProgress);
    splide.on('destroy', () => {
      if (progressBar) {
        progressBar.style.width = '0%';
      }
    });

    splide.mount();
    updateProgress();
  };

  const init = () => {
    const sliders = document.querySelectorAll(SLIDER_SELECTOR);
    sliders.forEach(initSlider);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
