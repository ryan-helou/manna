import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "icons");
await mkdir(OUT, { recursive: true });

const PAGE = "#faf7f1";
const ACCENT = "#a56724";
const INK = "#1c1815";

/**
 * The mark: an open book, and above it the small round of bread that fell each
 * morning. Two shapes, one idea, legible at 32 pixels.
 */
function svg({ padded = false, rounded = true } = {}) {
  const mark = `
    <circle cx="256" cy="150" r="46" fill="url(#g)"/>
    <path d="M96 232c50-26 106-26 156 4v168c-50-30-106-30-156-4Z" fill="none" stroke="${INK}" stroke-width="22" stroke-linejoin="round"/>
    <path d="M416 232c-50-26-106-26-156 4v168c50-30 106-30 156-4Z" fill="none" stroke="${INK}" stroke-width="22" stroke-linejoin="round"/>
    <path d="M256 236v168" fill="none" stroke="${INK}" stroke-width="18" stroke-linecap="round"/>`;
  const inner = padded
    ? `<g transform="translate(256 256) scale(0.74) translate(-256 -256)">${mark}</g>`
    : mark;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${ACCENT}"/>
      <stop offset="100%" stop-color="#d9a14e"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded && !padded ? 96 : 0}" fill="${PAGE}"/>
  ${inner}
</svg>`;
}

const plain = Buffer.from(svg());
const maskable = Buffer.from(svg({ padded: true }));

await Promise.all([
  sharp(plain).resize(192, 192).png().toFile(path.join(OUT, "icon-192.png")),
  sharp(plain).resize(512, 512).png().toFile(path.join(OUT, "icon-512.png")),
  sharp(maskable).resize(512, 512).png().toFile(path.join(OUT, "maskable-512.png")),
  // Apple squares it off and rounds the corners itself, so ship it edge to edge.
  sharp(Buffer.from(svg({ rounded: false })))
    .resize(180, 180)
    .flatten({ background: PAGE })
    .png()
    .toFile(path.join(OUT, "apple-icon.png")),
  writeFile(path.join(OUT, "mark.svg"), svg()),
]);

// Next serves app/icon.png automatically as the favicon.
await sharp(plain).resize(48, 48).png().toFile(path.join(process.cwd(), "app", "icon.png"));

console.log("icons written to public/icons + app/icon.png");
