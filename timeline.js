const items = document.querySelectorAll('.timeline__item');
const svg = document.querySelector('.timeline__path');
const path = svg?.querySelector('path');

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function positionTimelineItems() {
  if (!svg || !path || items.length === 0) return;

  const totalLength = path.getTotalLength();
  const viewBox = svg.viewBox?.baseVal;
  const viewWidth = viewBox?.width || 375;
  const viewHeight = viewBox?.height || 1376;

  items.forEach((item) => {
    const progress = clamp(parseFloat(item.dataset.progress || '0'), 0, 1);
    const point = path.getPointAtLength(totalLength * progress);
    const xPercent = ((point.x - (viewBox?.x || 0)) / viewWidth) * 100;
    const yPercent = ((point.y - (viewBox?.y || 0)) / viewHeight) * 100;

    item.style.setProperty('--item-x', `${xPercent}%`);
    item.style.setProperty('--item-y', `${yPercent}%`);
  });
}

positionTimelineItems();

let resizeRaf;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(positionTimelineItems);
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const delay = entry.target.dataset.delay || 0;
          entry.target.style.transitionDelay = `${delay}s`;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    },
    {
      root: null,
      threshold: 0.3,
    }
  );

  items.forEach((item) => observer.observe(item));
} else {
  items.forEach((item) => item.classList.add('is-visible'));
}
