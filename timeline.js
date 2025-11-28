const items = document.querySelectorAll('.timeline__item');

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
      threshold: 0.35,
    }
  );

  items.forEach((item) => observer.observe(item));
} else {
  // graceful fallback: show everything immediately
  items.forEach((item) => item.classList.add('is-visible'));
}
