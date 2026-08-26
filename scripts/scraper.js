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

  // First: scrape homepage to discover all valid routes from navigation
  await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await waitForContent(page);

  const homeRouteLinks = await page.evaluate(() =>
    [...document.querySelectorAll('a[href]')]
      .map(a => a.getAttribute('href'))
      .filter(h => h && h.startsWith('/') && !h.startsWith('//') && h.length > 1)
  );
  const uniqueRoutes = [...new Set(homeRouteLinks)];
  const allPaths = ['/', ...uniqueRoutes, '/policy', '/terms', '/privacy'];

  for (const path of allPaths.slice(0, 10)) {
    try {
      const url = `${SITE_URL}${path}`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await waitForContent(page);

      const pageData = await page.evaluate(() => {
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

      const ssPath = `data/screenshots${path === '/' ? '/home' : path.replace(/\//g, '-')}.png`;
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

async function waitForContent(page) {
  // Wait for JS to hydrate and render dynamic content
  await page.waitForTimeout(3000);
  // Wait until body has visible text (not just "LOADING" template)
  try {
    await page.waitForFunction(() => {
      const text = document.body?.innerText?.trim() || '';
      return text.length > 50 && !text.startsWith('LOADING');
    }, { timeout: 10000 });
  } catch {
    // Continue even if timeout — page might genuinely have little content
  }
  await page.waitForTimeout(500);
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

  // Aggregate real facts from EVERY scraped page so posts cite specifics.
  const headings = [];
  const seenHeadings = new Set();
  const stats = [];
  const seenStats = new Set();
  const ctas = [];
  const seenCtas = new Set();

  for (const [path, page] of Object.entries(data.pages)) {
    for (const h of page.headings || []) {
      const text = (h.text || '').replace(/\s+/g, ' ').trim();
      if (text.length > 3 && text.length < 120 && !seenHeadings.has(text.toLowerCase())) {
        seenHeadings.add(text.toLowerCase());
        headings.push(text);
      }
    }
    const text = page.textContent || '';
    for (const m of text.matchAll(/\b\d[\d,.]*\s*(?:\+|k\b|%|★|x\b|LPA\b)?/g)) {
      const s = m[0].trim();
      if (/^\d{1}$/.test(s)) continue; // skip single digits / years noise handled below
      if (/^(19|20)\d{2}$/.test(s)) continue;
      if (!seenStats.has(s)) { seenStats.add(s); stats.push(s); }
    }
    for (const b of page.buttons || []) {
      const t = (b.text || '').replace(/\s+/g, ' ').trim();
      if (t && t.length < 40 && !seenCtas.has(t.toLowerCase())) { seenCtas.add(t.toLowerCase()); ctas.push(t); }
    }
  }

  // Prefer meaningful headings first (h1/h2 from home already lead).
  return {
    title: home?.title || '',
    description: home?.metaDescription || '',
    keyPhrases: headings.slice(0, 16),
    stats: stats.slice(0, 12),
    ctas: ctas.slice(0, 8),
    pagesScraped: Object.keys(data.pages).length,
    primaryColor: data.theme?.primary || '#6366f1',
    sections: home?.sections?.length || 0,
    buttonCount: home?.buttons?.length || 0,
  };
}

if (process.argv[1]?.endsWith('scraper.js')) {
  const data = await scrapeSite();
  console.log(JSON.stringify(data.summary, null, 2));
}
