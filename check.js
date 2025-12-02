const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://frequency-breathwork.webflow.io/blog/10-benefits-of-transformational-breathwork-for-anxiety-stress-and-burnout', { waitUntil: 'networkidle' });
  const attrs = await page.evaluate(() => {
    const btn = document.querySelector('.icon_play');
    if (!btn) return null;
    const attrEntries = {};
    for (const attr of btn.attributes) {
      attrEntries[attr.name] = attr.value;
    }
    return attrEntries;
  });
  console.log(attrs);
  await browser.close();
})();
