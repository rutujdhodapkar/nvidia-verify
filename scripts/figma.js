const FIGMA_API = 'https://api.figma.com/v1';

export async function getFigmaImageUrl(figmaToken, fileKey, nodeId) {
  if (!figmaToken || !fileKey || !nodeId) return null;

  try {
    const res = await fetch(`${FIGMA_API}/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=2`, {
      headers: { 'X-Figma-Token': figmaToken },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Figma ${res.status}`);

    const data = await res.json();
    const imageUrl = data.images?.[nodeId];
    if (imageUrl) {
      console.log(`[FIGMA] ✓ Exported frame: ${nodeId}`);
      return imageUrl;
    }
    throw new Error('No image in response');
  } catch (err) {
    console.log(`[FIGMA] Export failed: ${err.message}`);
    return null;
  }
}

export async function getFigmaFileData(figmaToken, fileKey) {
  if (!figmaToken || !fileKey) return null;

  try {
    const res = await fetch(`${FIGMA_API}/files/${fileKey}`, {
      headers: { 'X-Figma-Token': figmaToken },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Figma ${res.status}`);

    const data = await res.json();
    const pages = data.document?.children?.map(c => ({
      name: c.name,
      id: c.id,
      type: c.type,
      children: c.children?.map(ch => ({ name: ch.name, id: ch.id, type: ch.type })),
    })) || [];

    console.log(`[FIGMA] ✓ Loaded ${pages.length} pages from file ${fileKey}`);
    return { name: data.name, pages };
  } catch (err) {
    console.log(`[FIGMA] Load failed: ${err.message}`);
    return null;
  }
}
