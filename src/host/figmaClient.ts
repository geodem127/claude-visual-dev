import fetch from 'node-fetch';

const FIGMA_BASE = 'https://api.figma.com/v1';

export async function fetchFigmaScreenshot(fileKey: string, apiKey: string): Promise<string> {
  const fileRes = await fetch(`${FIGMA_BASE}/files/${fileKey}`, {
    headers: { 'X-Figma-Token': apiKey },
  });
  if (!fileRes.ok) throw new Error(`Figma API error: ${fileRes.status} ${fileRes.statusText}`);
  const file = await fileRes.json() as { document: { children: { id: string }[] } };
  const nodeId = file.document.children[0]?.id;
  if (!nodeId) throw new Error('No nodes found in Figma file');

  const imgRes = await fetch(`${FIGMA_BASE}/images/${fileKey}?ids=${nodeId}&format=png&scale=2`, {
    headers: { 'X-Figma-Token': apiKey },
  });
  if (!imgRes.ok) throw new Error(`Figma images API error: ${imgRes.status}`);
  const imgData = await imgRes.json() as { images: Record<string, string> };
  const imageUrl = Object.values(imgData.images)[0];
  if (!imageUrl) throw new Error('No image URL returned from Figma');

  const download = await fetch(imageUrl);
  const buffer = await download.buffer();
  return buffer.toString('base64');
}

export function extractFigmaFileKey(url: string): string {
  const match = url.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  if (!match) throw new Error('Invalid Figma URL');
  return match[1];
}
