document.addEventListener('DOMContentLoaded', () => {
  gsap.registerPlugin(ScrollTrigger);

  new SplitType('[text-split]', { types: 'lines', tagName: 'div' });
  gsap.set('[text-split]', { opacity: 1 });

  const master = gsap.timeline({
    scrollTrigger: {
      trigger: '.section_scroll',
      start: 'top top',
      end: '+=4000',
      scrub: true,
      pin: '.fixed_scroll_section',
    },
  });

  const blurIn = 'blur(18px)';
  const blurOut = 'blur(14px)';

  function add3DEffect(selector) {
    master
      .fromTo(
        `${selector} .line`,
        {
          opacity: 0,
          yPercent: 50,
          z: -200,
          rotateX: 10,
          filter: blurIn,
        },
        {
          opacity: 1,
          yPercent: 0,
          z: 0,
          rotateX: 0,
          filter: 'blur(0px)',
          duration: 2,
          stagger: 0.08,
          ease: 'power3.out',
        },
        '<'
      )
      .to(
        `${selector} .line`,
        {
          opacity: 0,
          yPercent: -50,
          z: -300,
          rotateX: -12,
          filter: blurOut,
          duration: 2,
          stagger: 0.08,
          ease: 'power3.in',
        },
        '>0.5'
      );
  }

  master.to('.center_txt._1', { opacity: 1, y: 0, duration: 0.2, ease: 'none' });
  add3DEffect('.center_txt._1');

  master.fromTo(
    '.active_1._1',
    { width: '0%' },
    { width: '100%', ease: 'none', duration: 2 },
    '<'
  );

  master.to('.center_txt._1', { opacity: 0, y: -20, duration: 0.2, ease: 'none' });

  master
    .to('.center_txt._2', { opacity: 1, y: 0, duration: 0.2, ease: 'none' })
    .to(
      '.number_circle div',
      { textContent: 2, duration: 0.01, snap: { textContent: 1 } },
      '<'
    );
  add3DEffect('.center_txt._2');

  master.fromTo(
    '.active_1._2',
    { width: '0%' },
    { width: '100%', ease: 'none', duration: 2 },
    '<'
  );

  master.to('.center_txt._2', { opacity: 0, y: -20, duration: 0.2, ease: 'none' });

  master
    .to(['.central_words .tag_flex:nth-child(3)', '.central_words .tag_flex:nth-child(4)'], {
      opacity: 1,
      y: 0,
      duration: 0.4,
      ease: 'none',
    })
    .to(
      ['.central_words .tag_flex:nth-child(2)', '.central_words .tag_flex:nth-child(5)'],
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'none',
      },
      '>0.2'
    )
    .to(
      ['.central_words .tag_flex:nth-child(1)', '.central_words .tag_flex:nth-child(6)'],
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'none',
      },
      '>0.2'
    )
    .to(['.central_words .tag_flex:nth-child(1)', '.central_words .tag_flex:nth-child(6)'], {
      opacity: 0,
      y: -20,
      duration: 0.3,
      ease: 'none',
    })
    .to(
      ['.central_words .tag_flex:nth-child(2)', '.central_words .tag_flex:nth-child(5)'],
      {
        opacity: 0,
        y: -20,
        duration: 0.3,
        ease: 'none',
      },
      '>0.15'
    )
    .to(
      ['.central_words .tag_flex:nth-child(3)', '.central_words .tag_flex:nth-child(4)'],
      {
        opacity: 0,
        y: -20,
        duration: 0.3,
        ease: 'none',
      },
      '>0.15'
    );

  master
    .to('.center_txt._3', { opacity: 1, y: 0, duration: 0.2, ease: 'none' })
    .to(
      '.number_circle div',
      { textContent: 3, duration: 0.01, snap: { textContent: 1 } },
      '<'
    );
  add3DEffect('.center_txt._3');

  master.fromTo(
    '.active_1._3',
    { width: '0%' },
    { width: '100%', ease: 'none', duration: 2 },
    '<'
  );
});

document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
.center_txt {
  perspective: 1000px;
}
.center_txt .line {
  display: block;
  text-align: center;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  will-change: transform, opacity, filter;
}
.active_1 {
  background-color: #fff;
  transform-origin: left center;
  will-change: width;
}
</style>`
);
