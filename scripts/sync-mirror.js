import 'dotenv/config';
import { syncMirror, getMirrorMeta } from '../lib/cosmos-cache.js';

const force = process.argv.includes('--force');

async function main() {
  const meta = await getMirrorMeta();
  console.log(`[sync] current mirror: ${meta.docCount || 0} docs, last synced ${meta.lastSyncAt || 'never'}`);
  const result = await syncMirror({ force });
  if (result.skipped) console.log('[sync] no Cosmos reads used this run');
}

main().catch((err) => { console.error(`[sync] FAILED: ${err.message}`); process.exit(1); });
