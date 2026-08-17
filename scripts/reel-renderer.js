import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { writeFile, readFile, unlink, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

const FPS = 25;
const SEG_DUR = 6;
const FADE = 0.8;

export async function fetchSongAudio(title, artist) {
  if (!title) return null;
  const term = encodeURIComponent(`${title} ${artist || ''}`.trim());
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=5`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`iTunes search ${res.status}`);
    const data = await res.json();
    const track = (data.results || []).find(r => r.previewUrl) || (data.results || [])[0];
    if (!track?.previewUrl) throw new Error('no previewUrl in iTunes results');
    const audioRes = await fetch(track.previewUrl, { signal: AbortSignal.timeout(30000) });
    if (!audioRes.ok) throw new Error(`preview download ${audioRes.status}`);
    const buf = Buffer.from(await audioRes.arrayBuffer());
    console.log(`[REEL] Song audio fetched: ${track.trackName} — ${track.artistName} (${buf.length} bytes)`);
    return { buffer: buf, title: track.trackName, artist: track.artistName, previewUrl: track.previewUrl };
  } catch (err) {
    console.warn(`      ⚠ Could not fetch song audio: ${err.message}`);
    return null;
  }
}

async function ffmpeg(args) {
  const { stdout, stderr } = await execFileAsync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
  if (stderr) throw new Error(stderr.split('\n').slice(0, 8).join(' '));
  return stdout;
}

async function makeSegment(inputPath, outputPath, frames) {
  await ffmpeg([
    '-i', inputPath,
    '-vf',
    `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0015,1.15)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=${FPS},format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'veryfast',
    '-t', String(SEG_DUR),
    outputPath,
  ]);
}

export async function renderReelVideo({ cards, audio }) {
  const work = await mkdir(join(tmpdir(), `reel-${Date.now()}`), { recursive: true });
  try {
    const frames = Math.round(SEG_DUR * FPS);
    const segments = [];
    for (let i = 0; i < cards.length; i++) {
      const seg = join(work, `seg-${i}.mp4`);
      const img = join(work, `card-${i}.png`);
      await writeFile(img, cards[i]);
      await makeSegment(img, seg, frames);
      segments.push(seg);
    }

    // Fade-crossfade the segments together. Each xfade shortens the timeline by FADE.
    const total = cards.length * SEG_DUR - (cards.length - 1) * FADE;
    const concatPath = join(work, 'concat.mp4');

    const inputs = segments.flatMap(s => ['-i', s]);
    const steps = [];
    for (let i = 0; i < cards.length - 1; i++) {
      const offset = (i + 1) * SEG_DUR - (i + 1) * FADE;
      const in0 = i === 0 ? `[0:v]` : `[v0${i - 1}]`;
      const out = i === cards.length - 2 ? `[v]` : `[v0${i}]`;
      steps.push(`${in0}[${i + 1}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(2)}${out}`);
    }
    const fc = steps.join(';');
    await ffmpeg([...inputs, '-filter_complex', fc, '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-t', total.toFixed(2), concatPath]);

    // Mix the song audio in, trimmed to the video length with an outro fade.
    const reelPath = join(work, 'reel.mp4');
    const audioPath = join(work, 'audio.bin');
    if (audio?.buffer) {
      await writeFile(audioPath, audio.buffer);
      await ffmpeg([
        '-i', concatPath,
        '-i', audioPath,
        '-filter_complex',
        `[1:a]atrim=0:${total.toFixed(2)},afade=t=in:st=0:d=0.4,afade=t=out:st=${Math.max(0, total - 1.5).toFixed(2)}:d=1.5,asetpts=PTS-STARTPTS,aresample=44100[a]`,
        '-map', '0:v', '-map', '[a]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
        '-t', total.toFixed(2),
        reelPath,
      ]);
    } else {
      await ffmpeg(['-i', concatPath, '-c:v', 'copy', '-an', '-t', total.toFixed(2), reelPath]);
    }

    const buf = await readFile(reelPath);
    console.log(`[REEL] Rendered ${total.toFixed(1)}s video (${buf.length} bytes)`);
    return buf;
  } finally {
    for (const f of await readdir(work)) {
      await unlink(join(work, f)).catch(() => {});
    }
    await unlink(work).catch(() => {});
  }
}

export async function renderReel({ cards, song, caption }) {
  const audio = song ? await fetchSongAudio(song.title, song.artist) : null;
  const buf = await renderReelVideo({ cards, audio });
  return { buffer: buf, song: audio };
}