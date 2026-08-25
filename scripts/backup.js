import 'dotenv/config';
import { fbGet, fbPut } from '../lib/firebase.js';

const KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS || 30);
const BACKUP_EVERY_DAYS = Number(process.env.BACKUP_EVERY_DAYS || 5);

function todayStr() { return new Date().toISOString().slice(0, 10); }

async function shouldRun() {
  if (process.argv.includes('--force')) return true;
  const meta = (await fbGet('backups/meta')) || {};
  if (!meta.lastRunAt) return true;
  const days = (Date.now() - new Date(meta.lastRunAt).getTime()) / 86400000;
  if (days < BACKUP_EVERY_DAYS) {
    console.log(`[backup] next snapshot in ${Math.ceil(BACKUP_EVERY_DAYS - days)} days (last: ${meta.lastRunAt})`);
    return false;
  }
  return true;
}

async function main() {
  if (!(await shouldRun())) return;

  console.log('[backup] snapshotting Firebase mirror (no Cosmos reads)...');
  const enrollments = await fbGet('mirror/enrollments');
  if (!enrollments) {
    console.log('[backup] mirror empty — run `npm run sync-mirror -- --force` first');
    process.exit(1);
  }

  const count = Object.keys(enrollments).length;
  await fbPut(`backups/${todayStr()}/enrollments`, enrollments);

  const existing = await fbGet('backups');
  let deleted = 0;
  if (existing && typeof existing === 'object') {
    const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
    for (const date of Object.keys(existing)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date < cutoff && date !== todayStr()) {
        await fbPut(`backups/${date}`, null);
        deleted++;
      }
    }
  }

  await fbPut('backups/latest', { date: todayStr(), enrollmentCount: count, at: new Date().toISOString() });
  await fbPut('backups/meta', { lastRunAt: new Date().toISOString(), everyDays: BACKUP_EVERY_DAYS });
  console.log(`[backup] saved backups/${todayStr()} (${count} enrollments), pruned ${deleted} old snapshots — next in ${BACKUP_EVERY_DAYS} days`);
}

main().catch((err) => { console.error(`[backup] FAILED: ${err.message}`); process.exit(1); });
