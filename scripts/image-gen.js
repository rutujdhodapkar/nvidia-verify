const POLLINATIONS_URL = 'https://image.pollinations.ai/prompt';

export async function generateImage(post, theme, imageData) {
  const prompt = buildPollinationsPrompt(post, theme, imageData);
  const url = `${POLLINATIONS_URL}/${encodeURIComponent(prompt)}.png?width=1200&height=630&nofeed=true&model=flux`;

  console.log(`[IMAGE] Generating via Pollinations.ai...`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pollinations.ai error: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  console.log(`[IMAGE] ✓ Image generated: ${buffer.length} bytes`);

  return buffer;
}

function buildPollinationsPrompt(post, theme, imageData) {
  const color = theme?.primary || '#6366f1';
  const headline = imageData?.headline || 'DEV/CRAFT Virtual Internship';
  const subtext = imageData?.subtext || '100% Free for College Students';

  return `Professional LinkedIn banner for DEV/CRAFT — a free virtual internship platform. Clean modern design with dark background and ${color} purple accent. Large bold text: "${headline}". Subtitle: "${subtext}". Minimalist, tech-themed, abstract geometric shapes, no person visible. Text overlay centered. 4K, professional marketing material, no watermarks`;
}

if (process.argv[1]?.endsWith('image-gen.js')) {
  const buf = await generateImage('Test post about DEV/CRAFT internships', { primary: '#6366f1' }, {
    headline: 'Build Real Projects. Get Certified.',
    subtext: 'Free virtual internships for college students.'
  });
  console.log(`Image: ${buf.length} bytes`);
}
