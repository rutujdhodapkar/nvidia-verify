import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function generateImage(post, theme, imageData, hfToken) {
  const prompt = buildPrompt(post, theme, imageData);

  if (hfToken) {
    try {
      const buf = await generateHuggingFace(prompt, hfToken);
      if (buf) {
        console.log(`[IMAGE] ✓ Hugging Face FLUX: ${buf.length} bytes`);
        return buf;
      }
    } catch (err) {
      console.log(`[IMAGE] HF failed (${err.message}), falling back...`);
    }
  }

  const buf = await generatePollinations(prompt);
  console.log(`[IMAGE] ✓ Pollinations: ${buf.length} bytes`);
  return buf;
}

function buildPrompt(post, theme, imageData) {
  const color = theme?.primary || '#6366f1';
  const headline = imageData?.headline || 'DEV/CRAFT Virtual Internship';
  const subtext = imageData?.subtext || '100% Free for College Students';
  const cta = imageData?.cta || 'Apply at devcraft.fennark.xyz';
  return `Professional LinkedIn banner. Dark background with ${color} purple gradient. Large bold white text: "${headline}". Smaller subtitle: "${subtext}". Bottom CTA: "${cta}". Modern tech geometric abstract background, no people, no watermarks. Clean minimal corporate design. 1200x630 social media format.`;
}

async function generateHuggingFace(prompt, token) {
  const res = await fetch(
    'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { width: 1200, height: 630 },
      }),
    }
  );
  if (!res.ok) throw new Error(`HF ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function generatePollinations(prompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}.png?width=1200&height=630&nofeed=true&model=flux`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
