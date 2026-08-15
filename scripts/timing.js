// Peak-IST posting logic for the LinkedIn agent.
// Indian students scroll in these windows; posting inside them raises early-engagement
// density, which is what decides whether a post gets amplified in the first 60 minutes.

const PEAK_IST_HOURS = [12, 13, 14, 17, 18, 19, 20, 21];

function istNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t)?.value || '';
  return { hour: Number(get('hour')) % 24, minute: Number(get('minute')), day: get('weekday') };
}

const wait = ms => new Promise(r => setTimeout(r, ms));

export async function maybeWaitForPeakIST() {
  const optIn = process.env.POST_AT_PEAK === '1';
  const target = process.env.POST_TIME_IST;
  if (!optIn && !target) return;

  const MAX_WAIT_MS = 3 * 3600 * 1000; // GitHub Actions caps jobs at ~6h; never wait longer than 3h.
  const now = istNow();
  if (target) {
    const [th, tm] = target.split(':').map(Number);
    let msUntil = ((th - now.hour) * 3600 + (tm - now.minute) * 60) * 1000;
    if (msUntil < 0) msUntil += 24 * 3600 * 1000;
    if (msUntil > MAX_WAIT_MS) {
      console.log(`[TIMING] ${target} IST is too far away for a CI job — posting now instead`);
      return;
    }
    console.log(`[TIMING] Targeting ${target} IST — waiting ${(msUntil / 3600000).toFixed(1)}h`);
    await wait(msUntil);
    return;
  }

  if (PEAK_IST_HOURS.includes(now.hour)) {
    console.log(`[TIMING] ✓ Peak IST hour (${now.hour}:${String(now.minute).padStart(2, '0')}) — posting now`);
    return;
  }
  const next = PEAK_IST_HOURS.find(h => h > now.hour) ?? PEAK_IST_HOURS[0];
  let msUntil = ((next - now.hour) * 3600 - now.minute * 60) * 1000;
  if (next < now.hour) msUntil += 24 * 3600 * 1000;
  if (msUntil > MAX_WAIT_MS) {
    console.log(`[TIMING] Next peak (${next}:00 IST) is ${(msUntil / 3600000).toFixed(1)}h away — beyond CI limits, posting now instead`);
    return;
  }
  console.log(`[TIMING] Off-peak (${now.hour}:${String(now.minute).padStart(2, '0')} IST) — waiting ${(msUntil / 3600000).toFixed(1)}h for the next peak slot (${next}:00 IST) so Indian students are scrolling`);
  await wait(msUntil);
}
