import { chromium } from 'playwright';

const SITE_URL = 'https://devcraft.fennark.xyz';

export async function scrapeSite() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const data = { pages: {}, screenshots: [], theme: null, timestamp: new Date().toISOString() };

  const policyPaths = ['/', '/about', '/programs', '/contact', '/policy', '/terms', '/privacy'];
  for (const path of policyPaths) {
    try {
      const url = `${SITE_URL}${path}`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000);

      const pageData = await page.evaluate(() => {
        const styles = getComputedStyle(document.body);
        const allEls = document.querySelectorAll('*');

        const colors = [...new Set(
          Array.from(allEls).slice(0, 200).flatMap(el => {
            const s = getComputedStyle(el);
            return [s.color, s.backgroundColor, s.borderColor].filter(c => c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent');
          })
        )].slice(0, 20);

        const fonts = [...new Set(
          Array.from(allEls).slice(0, 100).map(el => getComputedStyle(el).fontFamily)
        )].filter(Boolean).slice(0, 10);

        const sections = Array.from(document.querySelectorAll('section, header, footer, div[class*="hero"], div[class*="banner"], div[class*="feature"]'))
          .map(s => ({
            tag: s.tagName,
            id: s.id,
            class: s.className?.slice(0, 100),
            text: s.innerText?.slice(0, 200),
          }));

        const buttons = Array.from(document.querySelectorAll('a, button'))
          .filter(el => el.innerText?.trim())
          .map(el => ({ text: el.innerText.trim(), href: el.href || null }))
          .slice(0, 30);

        return {
          title: document.title,
          metaDescription: document.querySelector('meta[name="description"]')?.content || '',
          textContent: (document.body?.innerText || '').slice(0, 8000),
          headings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({ tag: h.tagName, text: h.innerText.trim() })),
          links: Array.from(document.querySelectorAll('a[href]')).map(a => ({ text: a.innerText.trim(), href: a.href })).slice(0, 50),
          colors,
          fonts,
          sections: sections.slice(0, 15),
          buttons: buttons.slice(0, 20),
          bodyClass: document.body.className,
        };
      });

      data.pages[path] = pageData;

      const ssPath = `data/screenshots${path === '/' ? '/home' : path}.png`;
      await page.screenshot({ path: ssPath, fullPage: true });
      data.screenshots.push(ssPath);

      console.log(`[SCRAPE] ✓ ${url} (${pageData.textContent.length} chars, ${pageData.colors?.length || 0} colors found)`);
    } catch (err) {
      console.log(`[SCRAPE] ✗ ${SITE_URL}${path} — ${err.message}`);
    }
  }

  data.theme = extractTheme(data);
  data.summary = buildSummary(data);

  await browser.close();
  return data;
}

function extractTheme(data) {
  const home = data.pages['/'];
  if (!home) return { primary: '#6366f1', font: 'Inter, sans-serif' };

  const colorCounts = {};
  for (const p of Object.values(data.pages)) {
    for (const c of p.colors || []) { colorCounts[c] = (colorCounts[c] || 0) + 1; }
  }
  const sorted = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
  const primary = sorted.length > 1 ? sorted[1][0] : '#6366f1';
  return { primary, font: home.fonts?.[0] || 'Inter, sans-serif', allColors: sorted.slice(0, 8).map(([c]) => c) };
}

function buildSummary(data) {
  const home = data.pages['/'];
  return {
    title: home?.title || '',
    description: home?.metaDescription || '',
    keyPhrases: home?.headings?.map(h => h.text).filter(Boolean) || [],
    primaryColor: data.theme?.primary || '#6366f1',
    sections: home?.sections?.length || 0,
    buttonCount: home?.buttons?.length || 0,
  };
}

if (process.argv[1]?.endsWith('scraper.js')) {
  const data = await scrapeSite();
  console.log(JSON.stringify(data.summary, null, 2));
}
