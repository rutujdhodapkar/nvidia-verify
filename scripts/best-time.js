import 'dotenv/config';
import { fbGet, fbPut } from '../lib/firebase.js';

function toIST(date) {
  const ist = new Date(new Date(date).getTime() + 5.5 * 3600000);
  return { hour: ist.getUTCHours(), day: ist.getUTCDay() };
}

async function collectEntries() {
  const entries = [];
  const history = (await fbGet('posts/history')) || {};
  for (const p of Object.values(history)) if (p?.postedAt) entries.push(p);
  const mirrorPosts = (await fbGet('mirror/linkedinPosts')) || (await fbGet('mirror/posts')) || {};
  for (const p of Object.values(mirrorPosts)) {
    const at = p.postedAt || p.createdAt || p.publishedAt;
    if (!at) continue;
    entries.push({ postedAt: at, impressions: p.impressions ?? p.views, reactions: p.reactions ?? p.likes, comments: p.comments });
  }
  return entries;
}

export function analyze(entries) {
  const byHour = {};
  for (const e of entries) {
    const { hour } = toIST(e.postedAt);
    const eng = (e.impressions ?? 0) + (e.reactions ?? 0) * 12 + (e.comments ?? 0) * 40;
    (byHour[hour] = byHour[hour] || []).push({ eng, hasMetrics: e.impressions != null });
  }
  const hourScores = Object.entries(byHour)
    .map(([h, list]) => ({ hour: Number(h), posts: list.length, avgEngagement: Math.round(list.reduce((s, x) => s + x.eng, 0) / list.length), hasRealMetrics: list.some((x) => x.hasMetrics) }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  const withMetrics = hourScores.filter((h) => h.hasRealMetrics && h.posts >= 2);
  let bestHour, source;
  if (withMetrics.length) { bestHour = withMetrics[0].hour; source = 'measured'; }
  else if (hourScores.length >= 5) { bestHour = hourScores[0].hour; source = 'heuristic-post-times'; }
  else { bestHour = [13, 19, 20][new Date().getUTCDay() % 3]; source = 'default-peaks'; }

  return {
    generatedAt: new Date().toISOString(),
    totalPostsAnalyzed: entries.length,
    bestHourIST: bestHour,
    recommendedTimeIST: `${String(bestHour).padStart(2, '0')}:30`,
    source,
    hourTable: hourScores.sort((a, b) => a.hour - b.hour),
    setEnvLine: `POST_TIME_IST=${String(bestHour).padStart(2, '0')}:30`,
  };
}

async function recordPost() {
  const argv = process.argv.slice(3);
  const get = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
  const entry = {
    url: get('url') || '',
    postedAt: get('at') || new Date().toISOString(),
    impressions: get('impressions') ? Number(get('impressions')) : null,
    reactions: get('reactions') ? Number(get('reactions')) : null,
    comments: get('comments') ? Number(get('comments')) : null,
    recordedAt: new Date().toISOString(),
  };
  const history = (await fbGet('posts/history')) || {};
  history[Date.now().toString(36)] = entry;
  await fbPut('posts/history', history);
  console.log(`[best-time] recorded post ${entry.postedAt}`);
}

async function main() {
  if (process.argv.includes('record')) return recordPost();
  const entries = await collectEntries();
  if (!entries.length) {
    console.log('[best-time] no post data yet. Log one with:');
    console.log('  npm run best-time -- record --at "2026-08-25T19:30:00+05:30" --impressions 4200');
    return;
  }
  const report = analyze(entries);
  await fbPut('besttime/latest', report);
  console.log(`[best-time] analyzed ${report.totalPostsAnalyzed} posts → ${report.setEnvLine} (source: ${report.source})`);
  for (const h of report.hourTable) console.log(`${String(h.hour).padStart(4)} | ${h.posts} posts | avg ${h.avgEngagement}`);
}

main().catch((err) => { console.error(`[best-time] FAILED: ${err.message}`); process.exit(1); });
