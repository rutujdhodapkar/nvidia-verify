// DEV/CRAFT Lead Harvester — COLLECTION ONLY, NEVER EMAILS LEADS
// Daily agent: scrapes targets (web search -> college/T&P sites, direct
// websites, LinkedIn) with Playwright, extracts contact emails + details,
// dedupes against all repo CSVs + data/leads.csv + Firebase queue + blocklist,
// appends new leads to data/leads.csv, then emails a JSON + table report of
// the day's harvest to HARVEST_REPORT_TO (your own inbox ONLY).
//
// Leads are NEVER emailed and stay out of the mailing pipeline unless you set
// HARVEST_PUSH_QUEUE=1 explicitly.
//
// Usage:
//   npm run harvest            # scrape + save + email report to yourself
//   npm run harvest -- --dry-run

import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { isBlocked } from '../lib/blocklist.js';
import { sendEmail } from '../lib/email-provider.js';

const FIREBASE_URL = process.env.PORTFOLIO_FIREBASE_URL || 'https://portfolio-cfe62-default-rtdb.firebaseio.com';
const REPORT_TO = process.env.HARVEST_REPORT_TO || '';
const ROOT = process.cwd();
const TARGETS_FILE = path.join(ROOT, 'data', 'harvest-targets.json');
const LEADS_CSV = path.join(ROOT, 'data', 'leads.csv');
const LINKEDIN_STATE_FILE = path.join(ROOT, '.linkedin-session', 'state.json');

const NAV_TIMEOUT = 30000;
const MAX_LINKEDIN_PAGES = Number(process.env.HARVEST_MAX_LINKEDIN_PAGES || 3);
const MAX_SITE_VISITS = Number(process.env.HARVEST_MAX_SITE_VISITS || 12);
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// never bother visiting these — pure budget waste
const SKIP_VISIT_RE = /wikipedia\.org|youtube\.com|facebook\.com|instagram\.com|twitter\.com|(^|\.)x\.com\/|reddit\.com|amazon\.|flipkart\.|play\.google|apps\.apple|blog\.youtube|medium\.com|quora\.com/i;
// visit priority: colleges/universities first, then anything placement-y
const TIER1_RE = /\.ac\.in|\.edu(\.|$)/i;
const TIER2_RE = /placement|tnp/i;

const normUrl = (u) => { try { const x = new URL(u); return `${x.hostname}${x.pathname.replace(/\/+$/, '')}`; } catch { return u; } };

const DRY_RUN = process.argv.includes('--dry-run');

// ---------- firebase helpers ----------
async function fb(pathname, method = 'GET', body = null) {
  const res = await fetch(`${FIREBASE_URL}/${pathname}.json`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok && res.status !== 404) throw new Error(`Firebase ${method} ${pathname}: ${res.status}`);
  return res.json().catch(() => null);
}
const get = (p) => fb(p, 'GET');

function encodeKey(str) {
  return (str || '').toLowerCase().replace(/[.#$/[\]]/g, '_');
}

// ---------- email utils ----------
const normalize = (e) => (e || '').toLowerCase().trim();

function extractEmails(text) {
  return [...new Set((text || '').match(EMAIL_RE) || [])].map(normalize)
    .filter(e =>
      e.length < 100 &&
      !/\.(png|jpe?g|gif|svg|webp|css|js|ico)$/i.test(e) &&
      !/^(no-?reply|donotreply|postmaster|abuse|example)/i.test(e) &&
      !/(sentry|wixpress|example\.)/i.test(e)
    );
}

// ---------- dedupe sources ----------
function collectKnownFromCsvs() {
  const known = new Set();
  for (const dir of [ROOT, path.join(ROOT, 'data')]) {
    for (const f of fs.readdirSync(dir)) {
      if (!f.toLowerCase().endsWith('.csv')) continue;
      try {
        for (const m of fs.readFileSync(path.join(dir, f), 'utf8').match(EMAIL_RE) || []) known.add(normalize(m));
      } catch { /* skip unreadable */ }
    }
  }
  return known;
}

async function buildKnownEmails() {
  const known = collectKnownFromCsvs();
  console.log(`[DEDUPE] ${known.size} emails from local CSVs`);
  const queue = (await get('queue')) || {};
  let qCount = 0;
  for (const [key, val] of Object.entries(queue)) {
    known.add(normalize(val?.email || key.replace(/_/g, '.')));
    qCount++;
  }
  console.log(`[DEDUPE] ${qCount} emails from Firebase queue`);
  return known;
}

// ---------- scraping ----------
async function newPage(browser, opts = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    ...opts,
  });
  return { context, page: await context.newPage() };
}

async function harvestWebsite(page, url, method) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(1200);

  // crawl one level: this page + contact/about/team subpages (websites only)
  let links = [url];
  if (method === 'site-crawl') {
    const subLinks = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')]
        .map(a => a.href)
        .filter(h => /^https?:/.test(h) && /contact|about|team|placement|tpo/i.test(h))
        .slice(0, 4)
    );
    links = [...new Set([url, ...subLinks])].slice(0, 5);
  }

  const leads = [];
  for (const link of links) {
    try {
      if (link !== url) await page.goto(link, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      await page.waitForTimeout(600);
      const found = await page.evaluate(() => ({
        text: document.body?.innerText || '',
        mailtos: [...document.querySelectorAll('a[href^="mailto:"]')].map(a => a.getAttribute('href')),
        title: document.title || '',
        org: document.querySelector('meta[property="og:site_name"]')?.content || '',
      }));
      const detail = (found.org || found.title).slice(0, 140);
      for (const email of extractEmails(found.text + ' ' + found.mailtos.join(' '))) {
        leads.push({ email, name: '', detail, source: 'website', url: link, method });
      }
      console.log(`[SCRAPE] ✓ ${link}`);
    } catch (err) {
      console.warn(`[SCRAPE] ✗ ${link}: ${err.message.slice(0, 80)}`);
    }
  }
  return leads;
}

async function searchResultUrls(page, query, maxResults) {
  // Bing primary (DDG/Mojeek block headless browsers); decode /ck/a redirects.
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${Math.max(maxResults * 2, 10)}&mkt=en-IN`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(2000);
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('li.b_algo h2 a, li.b_algo cite')].map(a => a.href || a.textContent?.trim())
  );

  const urls = [];
  for (const h of hrefs) {
    try {
      let target = h;
      const u = new URL(h);
      if (/bing\.com$/.test(u.hostname) && u.pathname.startsWith('/ck/')) {
        const enc = (u.searchParams.get('u') || '').replace(/^a1/, '');
        target = Buffer.from(enc, 'base64url').toString('utf8');
      }
      if (/^https?:\/\//.test(target) && !/(^|\.)bing\.com|(^|\.)microsoft\.com/.test(new URL(target).hostname)) {
        urls.push(target.split('#')[0]);
      }
    } catch { /* malformed link */ }
  }

  if (urls.length === 0) {
    // fallback: DuckDuckGo HTML endpoint (works when their bot-wall is relaxed)
    try {
      await page.goto(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      await page.waitForTimeout(1500);
      for (const h of await page.evaluate(() => [...document.querySelectorAll('a.result__a')].map(a => a.getAttribute('href')))) {
        if (!h) continue;
        const abs = h.startsWith('//') ? `https:${h}` : h;
        const ddg = new URL(abs);
        const decoded = decodeURIComponent(ddg.searchParams.get('uddg') || abs);
        if (/^https?:\/\//.test(decoded) && !/duckduckgo\.com/.test(decoded)) urls.push(decoded);
      }
    } catch { /* fallback failed */ }
  }

  const filtered = urls.filter(u => !SKIP_VISIT_RE.test(u));
  const t1 = filtered.filter(u => TIER1_RE.test(u));
  const t2 = filtered.filter(u => !t1.includes(u) && TIER2_RE.test(u));
  const rest = filtered.filter(u => !t1.includes(u) && !t2.includes(u));
  // normalize away trailing-slash dupes, then order: colleges > placement > rest
  const seenUrls = new Set();
  const unique = [];
  for (const u of [...t1, ...t2, ...rest]) {
    const key = normUrl(u);
    if (seenUrls.has(key)) continue;
    seenUrls.add(key);
    unique.push(u);
  }
  console.log(`[SEARCH] "${query}" → ${unique.slice(0, maxResults).length} result(s)`);
  return unique.slice(0, maxResults);
}

async function harvestLinkedIn(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(3000);

  if (/login|authwall/.test(page.url())) {
    console.warn('[LINKEDIN] redirected to login/authwall — add .linkedin-session/state.json for logged-in scraping');
    return [];
  }

  const cards = await page.evaluate(() => {
    const nodes = document.querySelectorAll(
      '.entity-result__item, .reusable-search__result-container, [data-view-name="search-entity-result-universal-tab"]'
    );
    return [...nodes].map(n => ({
      name: n.querySelector('.entity-result__title-text a span[aria-hidden="true"], .app-aware-link span[aria-hidden="true"]')?.innerText?.trim()
        || n.querySelector('a.app-aware-link span')?.innerText?.trim() || '',
      headline: n.querySelector('.entity-result__primary-subtitle, .entity-result__content-summary')?.innerText?.trim() || '',
      link: n.querySelector('a.entity-result__title-text, a.app-aware-link')?.href || '',
    })).filter(c => c.name || c.link);
  });

  const leads = cards.map(c => ({
    email: '',
    name: c.name.replace(/\s*View profile\s*/i, '').trim(),
    headline: (c.headline || '').slice(0, 140),
    source: 'linkedin',
    url: (c.link || '').split('?')[0],
    method: 'linkedin-public',
  })).filter(c => c.name);

  console.log(`[LINKEDIN] ✓ ${url} — ${leads.length} profiles`);
  return leads;
}

// ---------- persistence ----------
function loadExistingLeadsCsv() {
  if (!fs.existsSync(LEADS_CSV)) return [];
  return fs.readFileSync(LEADS_CSV, 'utf8').split('\n').filter(Boolean);
}

function appendLeadsCsv(newRows) {
  const existing = loadExistingLeadsCsv();
  const hasHeader = existing.some(l => l.startsWith('email,'));
  const lines = [...existing];
  if (!hasHeader) lines.push('email,name,detail,source,url,method,addedAt');
  lines.push(...newRows.map(r =>
    [r.email || '', r.name || '', r.detail || r.headline || '', r.source || '', r.url || '', r.method || '', r.addedAt]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ));
  fs.mkdirSync(path.dirname(LEADS_CSV), { recursive: true });
  fs.writeFileSync(LEADS_CSV, lines.join('\n') + '\n');
}

// ---------- daily report (to YOUR inbox only) ----------
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function buildReport(leads, stats) {
  const rows = leads.length === 0
    ? `<tr><td colspan="6" style="padding:16px 24px; color:#888;">No new leads today.</td></tr>`
    : leads.map(l => `
      <tr style="border-top:1px solid #ececec;">
        <td style="padding:10px 12px;"><strong>${esc(l.email || '(profile only)')}</strong><br><span style="color:#666;">${esc(l.name)}</span></td>
        <td style="padding:10px 12px; color:#333;">${esc(l.detail || l.headline)}</td>
        <td style="padding:10px 12px;">${esc(l.source)}<br><span style="color:#999; font-size:11px;">${esc(l.method)}</span></td>
        <td style="padding:10px 12px;"><a href="${esc(l.url)}" style="color:#000; word-break:break-all;">${esc((l.url || '').slice(0, 60))}</a></td>
      </tr>`).join('');

  return `<!DOCTYPE html><html><body style="margin:0; padding:0; background:#efefef; font-family:'Helvetica Neue', Arial, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#efefef; padding:32px 0;"><tr><td align="center">
<table width="720" style="background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="padding:28px 32px 8px;">
    <span style="font-size:17px; font-weight:800;">&#8997; DevCraft Lead Harvester</span>
    <h1 style="margin:12px 0 4px; font-size:21px; font-weight:800;">Daily harvest: ${leads.length} new lead(s)</h1>
    <p style="margin:0; font-size:13px; color:#777;">${stats.visited} pages visited &bull; ${stats.targets} targets processed &bull; saved to data/leads.csv</p>
  </td></tr>
  <tr><td style="padding:12px 20px 20px;">
    <table width="100%" style="border-collapse:collapse; font-size:12.5px;">
      <tr style="background:#f7f7f7; text-align:left; color:#555;">
        <th style="padding:8px 12px;">Contact</th><th style="padding:8px 12px;">Who / Where</th><th style="padding:8px 12px;">Source</th><th style="padding:8px 12px;">Found at</th>
      </tr>${rows}
    </table>
  </td></tr>
  <tr><td style="padding:0 32px 28px;">
    <p style="font-size:12px; font-weight:700; margin:0 0 8px; color:#555;">RAW JSON</p>
    <pre style="background:#111; color:#d4d4d4; padding:16px; border-radius:10px; font-size:11px; overflow-x:auto; max-height:420px;">${esc(JSON.stringify(leads, null, 2))}</pre>
    <p style="font-size:10px; color:#bbb; margin-top:14px;">Collection-only run &mdash; no lead was emailed. Push to pipeline requires HARVEST_PUSH_QUEUE=1.</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

async function sendReport(leads, stats) {
  if (!REPORT_TO) { console.log('[REPORT] HARVEST_REPORT_TO not set — skipping report email'); return; }
  const date = new Date().toISOString().slice(0, 10);
  try {
    await sendEmail({
      to: REPORT_TO,
      subject: `[Lead Harvester] ${date}: ${leads.length} new lead(s)`,
      html: buildReport(leads, stats),
    });
    console.log(`[REPORT] ✓ sent to ${REPORT_TO}`);
  } catch (err) {
    console.error(`[REPORT] ✗ ${err.message}`);
  }
}

// ---------- main ----------
async function main() {
  console.log(`=== Lead Harvester ${new Date().toISOString()} ===`);
  console.log('MODE: collection only — saves locally, never contacts anyone\n');
  if (DRY_RUN) console.log('DRY RUN — nothing saved, no report sent\n');

  const targets = JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf8')).targets || [];
  if (targets.length === 0) { console.log('No targets configured'); return; }

  const seen = await buildKnownEmails();
  const fresh = [];
  const visitedUrls = new Set();
  let linkedinBudget = MAX_LINKEDIN_PAGES;
  let siteBudget = MAX_SITE_VISITS;

  const browser = await chromium.launch({ headless: true });

  try {
    for (const target of targets) {
      if (target.type === 'linkedin' && linkedinBudget-- <= 0) continue;
      if (target.type !== 'linkedin' && siteBudget <= 0) {
        console.log('[BUDGET] site-visit budget reached — stopping web targets');
        break;
      }

      if (target.type === 'search') {
        const { context, page } = await newPage(browser);
        try {
          const urls = await searchResultUrls(page, target.query, target.maxResults || 6);
          for (const resultUrl of urls) {
            if (siteBudget <= 0) break;
            if (visitedUrls.has(normUrl(resultUrl))) continue;
            visitedUrls.add(normUrl(resultUrl));
            siteBudget--;
            const wp = await context.newPage();
            try {
              for (const lead of await harvestWebsite(wp, resultUrl, 'web-search')) {
                if (seen.has(lead.email) || fresh.some(f => f.email === lead.email && f.url === lead.url)) continue;
                if (isBlocked(lead.email)) continue;
                seen.add(lead.email);
                fresh.push({ ...lead, addedAt: new Date().toISOString() });
              }
            } finally { await wp.close().catch(() => {}); }
          }
        } finally { await context.close().catch(() => {}); }
        continue;
      }

      const useLinkedIn = target.type === 'linkedin';
      const opts = useLinkedIn && fs.existsSync(LINKEDIN_STATE_FILE)
        ? { storageState: LINKEDIN_STATE_FILE } : {};
      const { context, page } = await newPage(browser, opts);
      try {
        const leads = useLinkedIn
          ? await harvestLinkedIn(page, target.url)
          : await (visitedUrls.has(normUrl(target.url)) ? [] : harvestWebsite(page, target.url, 'direct'));
        visitedUrls.add(normUrl(target.url));
        if (!useLinkedIn) siteBudget--;
        for (const lead of leads) {
          const key = lead.email || `li:${lead.url}`;
          if (seen.has(key) || fresh.some(f => (f.email || `li:${f.url}`) === key)) continue;
          if (lead.email && isBlocked(lead.email)) continue;
          seen.add(key);
          fresh.push({ ...lead, addedAt: new Date().toISOString() });
        }
      } finally { await context.close().catch(() => {}); }
    }
  } finally {
    await browser.close();
  }

  const stats = { visited: visitedUrls.size, targets: targets.length, when: new Date().toISOString() };
  console.log(`\n[HARVEST] ${fresh.length} new lead(s)`);

  if (DRY_RUN) {
    for (const l of fresh.slice(0, 25)) console.log(`  ○ [${l.source}/${l.method}] ${l.email || '(no email)'} ${l.name} — ${l.detail || l.headline || ''}`);
    return;
  }

  if (fresh.length > 0) {
    appendLeadsCsv(fresh);
    console.log(`[CSV] appended ${fresh.length} lead(s) → ${path.relative(ROOT, LEADS_CSV)}`);

    if (process.env.HARVEST_PUSH_QUEUE === '1') {
      let pushed = 0;
      for (const lead of fresh.filter(l => l.email)) {
        const key = encodeKey(lead.email);
        if (await get(`queue/${key}`)) continue;
        await fb(`queue/${key}`, 'PATCH', {
          email: lead.email, name: lead.name || '', source: lead.source,
          sourceUrl: lead.url, addedAt: new Date().toISOString(),
        });
        pushed++;
      }
      console.log(`[QUEUE] ${pushed} lead(s) pushed to Firebase promo queue`);
    } else {
      console.log('[QUEUE] skipped — collection-only mode (HARVEST_PUSH_QUEUE not set)');
    }
  }

  await sendReport(fresh, stats);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });
