// api/story-card.js
// Generates a 9:16 (1080x1920) portrait story card PNG for Facebook Stories.
// Takes: ?title=...&image=...&credit=...
// Returns: image/png

import sharp from 'sharp';

function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // If a single word is longer than maxChars, hard-break it
      if (word.length > maxChars) {
        lines.push(word.substring(0, maxChars));
        current = word.substring(maxChars);
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default async function handler(req, res) {
  const { title = '', image = '', credit = '' } = req.query;

  const W = 1080;
  const H = 1920;

  // ── 1. Fetch and resize the thumbnail ──────────────────────────────────────
  let baseBuffer;
  try {
    if (!image) throw new Error('no image');
    const resp = await fetch(image, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const raw = Buffer.from(await resp.arrayBuffer());
    baseBuffer = await sharp(raw)
      .resize(W, H, { fit: 'cover', position: 'centre' })
      .png()
      .toBuffer();
  } catch (e) {
    console.warn('[story-card] thumbnail fetch failed, using solid bg:', e.message);
    baseBuffer = await sharp({
      create: { width: W, height: H, channels: 3, background: { r: 20, g: 20, b: 30 } }
    }).png().toBuffer();
  }

  // ── 2. Build SVG overlay ────────────────────────────────────────────────────
  // Title: large bold white text, wrapped ~22 chars/line at 68px
  const titleLines  = wrapText(escapeXml(title.substring(0, 120)), 22);
  const creditText  = escapeXml(credit);

  const fontSize    = 68;
  const lineHeight  = 84;
  const creditSize  = 46;
  const paddingX    = 72;
  const bottomPad   = 110;

  // Position text block: credit at bottom, title above it
  const creditY   = H - bottomPad;
  const titleStartY = creditY - creditSize - 30 - (titleLines.length * lineHeight);

  const titleSvgLines = titleLines.map((line, i) => `
    <text
      x="${paddingX}"
      y="${titleStartY + i * lineHeight}"
      fill="white"
      font-size="${fontSize}"
      font-weight="bold"
      font-family="sans-serif"
    >${line}</text>`).join('');

  // Gradient: transparent → very dark, covers bottom 55% of image
  const gradientOverlay = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="black" stop-opacity="0"/>
        <stop offset="45%"  stop-color="black" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.92"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>

    ${titleSvgLines}

    <text
      x="${paddingX}"
      y="${creditY}"
      fill="rgba(255,255,255,0.72)"
      font-size="${creditSize}"
      font-family="sans-serif"
    >${creditText}</text>
  </svg>`;

  const overlayBuf = Buffer.from(gradientOverlay);

  // ── 3. Composite overlay on top of thumbnail ────────────────────────────────
  try {
    const finalPng = await sharp(baseBuffer)
      .composite([{ input: overlayBuf, blend: 'over' }])
      .png()
      .toBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(finalPng);
  } catch (e) {
    console.error('[story-card] composite failed:', e.message);
    return res.status(500).json({ error: 'Image generation failed' });
  }
}
