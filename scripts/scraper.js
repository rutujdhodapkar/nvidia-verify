import { chromium } from 'playwright';

const SITE_URL = 'https://devcraft.fennark.xyz';

export async function scrapeSite() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const data = { pages: {}, timestamp: new Date().toISOString() };

  for (const path of ['/', '/about', '/programs', '/contact']) {
    try {
      const url = `${SITE_URL}${path}`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      const pageData = await page.evaluate(() => {
        const textContent = document.body?.innerText || '';
        const title = document.title || '';
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({
          tag: h.tagName,
          text: h.innerText.trim()
        }));
        const links = Array.from(document.querySelectorAll('a[href]'))
          .filter(a => a.href && !a.href.startsWith('javascript'))
          .map(a => ({ text: a.innerText.trim(), href: a.href }));
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        return { title, textContent: textContent.slice(0, 5000), headings, links, metaDescription };
      });

      data.pages[path] = pageData;
      console.log(`[SCRAPE] ✓ ${url}`);
    } catch (err) {
      console.log(`[SCRAPE] ✗ ${SITE_URL}${path} — ${err.message}`);
    }
  }

  data.summary = buildSummary(data);
  await browser.close();
  return data;
}

function buildSummary(data) {
  const home = data.pages['/'];
  const headings = home?.headings?.map(h => h.text).filter(Boolean) || [];
  const description = home?.metaDescription || '';
  return { description, keyPhrases: headings };
}

if (process.argv[1]?.endsWith('scraper.js')) {
  const data = await scrapeSite();
  console.log(JSON.stringify(data, null, 2));
}
