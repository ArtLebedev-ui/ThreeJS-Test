const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (msg) => console.log('console:', msg.type(), msg.text()));
  await page.goto('https://frequency-breathwork.webflow.io/blog/10-benefits-of-transformational-breathwork-for-anxiety-stress-and-burnout', { waitUntil: 'domcontentloaded' });
  await page.click('.icon_play');
  await page.waitForTimeout(1500);
  const state = await page.evaluate(() => ({
    ariaPressed: document.querySelector('.icon_play')?.getAttribute('aria-pressed'),
    barWidth: document.querySelector('.active_bar')?.style.width,
    status: document.querySelector('.listen_stop_article .base_txt')?.textContent,
    speechSupported: typeof window.speechSynthesis !== 'undefined'
  }));
  console.log(state);
  await browser.close();
})();
