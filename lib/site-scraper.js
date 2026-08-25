// Shared site scraper for LinkedIn + Instagram automations.
// - Re-scrapes devcraft.fennark.xyz at most every 5 days ("5 multiple day" rule)
// - Persists to portfolio Firebase under siteData/latest (DB = reference store)
// - Self-healing: per-page retries, global error budget (max 10 failures),
//   Playwright scraper with fetch+sitemap fallback, stale-cache rescue.

import { pfGet, pfPut } from './portfolio-firebase.js';

const SITE_URL = process.env.SITE_URL || 'https://devcraft.fennark.xyz';
const STATE_PATH = 'siteData/latest';
const MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
export const MAX_FAILURES = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- error budget ----------
export function createErrorBudget(max = MAX_FAILURES) {
  let failures = 0;
  return {
    recordFailure() { failures++; },
    exceeded() { return failures >= max; },
    get count() { return failures; },
    get max() { return max; },
  };
}

// Retry any async op up to maxAttempts with linear backoff; feeds a shared budget
export async function withRetries(fn, label, { maxAttempts = 3, budget } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (budget?.exceeded()) throw new Error(`error budget exhausted (${budget.count}/${budget.max}) before ${label}`);
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      budget?.recordFailure();
      console.warn(`[retry] ${label} ${attempt}/${maxAttempts} failed: ${String(err.message).slice(0, 140)}`);
      if (attempt < maxAttempts) await sleep(Math.min(2000 * attempt, 10000));
    }
  }
  throw lastErr;
}

// ---------- strategy 1: playwright (full fidelity — colors, sections, buttons) ----------
async function scrapeWithPlaywright(budget) {
  const mod = await import('../scripts/scraper.js');
  return withRetries(() => mod.scrapeSite(), 'playwright scrape', { maxAttempts: 2, budget });
}

// ---------- strategy 2: fetch + sitemap (no browser needed) ----------
function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function scrapeWithFetch(budget) {
  const pages = {};
  const paths = new Set(['/', '/about', '/policy', '/terms', '/privacy', '/contact']);

  // discover routes from sitemap first
  try {
    const smRes = await fetch(`${SITE_URL}/sitemap.xml`, { signal: AbortSignal.timeout(10000) });
    if (smRes.ok) {
      const xml = await smRes.text();
      for (const m of xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)) {
        try {
          const u = new URL(m[1]);
          if (u.hostname === new URL(SITE_URL).hostname) paths.add(u.pathname);
        } catch { /* skip malformed */ }
      }
    }
  } catch (err) {
    budget?.recordFailure();
    console.warn(`[scrape-fetch] sitemap unavailable: ${err.message.slice(0, 80)}`);
  }

  for (const path of [...paths].slice(0, 15)) {
    if (budget?.exceeded()) { console.warn(`[scrape-fetch] error budget hit — stopping at ${Object.keys(pages).length} pages`); break; }
    try {
      const res = await fetch(`${SITE_URL}${path}`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i);
      pages[path] = {
        title: titleMatch ? htmlToText(titleMatch[1]).slice(0, 200) : '',
        metaDescription: descMatch ? descMatch[1].slice(0, 300) : '',
        textContent: htmlToText(html).slice(0, 5000),
        buttons: [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>|<a[^>]*class="[^"]*btn[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)]
          .map((m) => htmlToText(m[1] || m[2])).filter(Boolean).slice(0, 10),
      };
      console.log(`[scrape-fetch] ✓ ${path} (${pages[path].textContent.length} chars)`);
    } catch (err) {
      budget?.recordFailure();
      console.warn(`[scrape-fetch] ✗ ${path}: ${err.message.slice(0, 90)}`);
    }
  }
  return { pages, theme: null, screenshots: [], timestamp: new Date().toISOString() };
}

// ---------- public API ----------
export async function ensureFreshSiteData({ force = false, budget } = {}) {
  // Firebase rejects / . # $ [ ] in keys — persist pages as an array instead
  const existing = await pfGet(STATE_PATH).catch(() => null);
  const existingPages = existing?.pagesList
    ? Object.fromEntries(existing.pagesList.map(({ path, ...rest }) => [path, rest]))
    : null;
  const ageOk = existing?.scrapedAt && (Date.now() - new Date(existing.scrapedAt).getTime()) < MAX_AGE_MS;

  if (!force && ageOk && existingPages && Object.keys(existingPages).length > 0) {
    const days = ((Date.now() - new Date(existing.scrapedAt)) / 86400000).toFixed(1);
    console.log(`[SiteData] using cached scrape (${days}d old, ${Object.keys(existingPages).length} pages) — next refresh in ${(5 - days).toFixed(1)}d`);
    return { ...existing, pages: existingPages };
  }

  console.log(`[SiteData] ${force ? 'forced refresh' : existing?.scrapedAt ? 'cache stale (>5d)' : 'cache missing'} — scraping ${SITE_URL}`);
  const b = budget || createErrorBudget();

  let data = null;
  try {
    data = await scrapeWithPlaywright(b);
  } catch (err) {
    console.warn(`[SiteData] playwright path failed: ${String(err.message).slice(0, 100)} — trying fetch fallback`);
  }
  if (!data?.pages || Object.keys(data.pages).length === 0) {
    data = await scrapeWithFetch(b);
  }

  if (data?.pages && Object.keys(data.pages).length > 0) {
    const pagesList = Object.entries(data.pages).map(([path, page]) => ({ path, ...page }));
    const record = { scrapedAt: new Date().toISOString(), source: data.theme ? 'playwright' : 'fetch', pagesList };
    await pfPut(STATE_PATH, record);
    console.log(`[SiteData] saved to DB (${pagesList.length} pages)`);
    return { ...record, pages: data.pages };
  }

  // total failure → self-heal with stale cache rather than dying
  if (existingPages) {
    console.warn(`[SiteData] all scrapers failed (${b.count}/${b.max} errors) — falling back to stale cache from ${existing.scrapedAt}`);
    return { ...existing, pages: existingPages };
  }
  throw new Error(`Site scrape failed completely (${b.count}/${b.max} errors) and no cache exists`);
}
