import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Every icon is cut from design/logo-source.png, the artwork itself. Nothing is
 * redrawn: this lifts the mark off its own paper and sets it on flat ground at
 * the sizes the manifest, iOS and the favicon each want.
 *
 * The lift is worth explaining. The source is a render, so its paper carries
 * grain and a slight vignette. Padding it to a new size left a visible square
 * seam where that paper met flat colour. Keying the ink out to transparency and
 * compositing it fresh removes the seam, the grain and the vignette in one go,
 * while leaving every line exactly where the artwork put it.
 *
 * Run with `npm run icons` after replacing the source file.
 */

const SRC = path.join(process.cwd(), "design", "logo-source.png");
const OUT = path.join(process.cwd(), "public", "icons");
await mkdir(OUT, { recursive: true });

const INK = { r: 0xae, g: 0x6e, b: 0x26 }; // the amber of the artwork
const PAGE = { r: 250, g: 247, b: 241 };   // --page, the app's light ground
const PAGE_DARK = { r: 20, g: 17, b: 14 }; // --page in dark mode

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** The mark alone, on transparency, its edges kept soft where they were soft. */
async function inkOnly() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const out = Buffer.alloc(info.width * info.height * 4);
  // Anything at paper luminance is nothing; anything at ink luminance is solid.
  // In between carries the antialiasing, which is what keeps the curves smooth.
  //
  // The reference is the DARKEST paper in the source, not the lightest. The
  // render carries a vignette, so its corners sit about eleven luminance points
  // below the centre; keyed against the light value they came through at four
  // per cent alpha, which is invisible on white and a grey haze on anything
  // else. A small deadzone above that clears the grain with it.
  const paperY = luma(238, 231, 214);
  const inkY = luma(INK.r, INK.g, INK.b);
  const DEADZONE = 0.05;
  for (let i = 0, o = 0; i < data.length; i += ch, o += 4) {
    const y = luma(data[i], data[i + 1], data[i + 2]);
    let t = (paperY - y) / (paperY - inkY);
    t = (t - DEADZONE) / (1 - DEADZONE);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    out[o] = INK.r;
    out[o + 1] = INK.g;
    out[o + 2] = INK.b;
    out[o + 3] = Math.round(t * 255);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

const mark = await sharp(await inkOnly()).trim({ threshold: 4 }).png().toBuffer();
const markMeta = await sharp(mark).metadata();

/** The mark centred on flat ground, occupying `fill` of the square. */
async function icon(size, fill, ground) {
  const inner = Math.round(size * fill);
  const scale = inner / Math.max(markMeta.width, markMeta.height);
  const resized = await sharp(mark)
    .resize({
      width: Math.round(markMeta.width * scale),
      height: Math.round(markMeta.height * scale),
      kernel: "lanczos3",
    })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { ...ground, alpha: 1 } },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

const round = (size) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <rect width="${size}" height="${size}" rx="${Math.round(size * 0.1875)}" fill="#fff"/>
     </svg>`,
  );

// Standard icons: rounded, the mark at 72% of the square.
for (const size of [512, 192]) {
  await sharp(await icon(size, 0.72, PAGE))
    .composite([{ input: round(size), blend: "dest-in" }])
    .png()
    .toFile(path.join(OUT, `icon-${size}.png`));
}

// Maskable: Android may crop to a circle, so the mark sits well inside.
await sharp(await icon(512, 0.56, PAGE)).png().toFile(path.join(OUT, "maskable-512.png"));

// Apple rounds the corners itself, so this goes out square and opaque.
await sharp(await icon(180, 0.74, PAGE)).flatten({ background: PAGE }).png()
  .toFile(path.join(OUT, "apple-icon.png"));

// The favicon runs the mark nearly edge to edge: at 32 pixels margin is waste.
for (const [size, dest] of [
  [32, path.join(OUT, "favicon-32.png")],
  [48, path.join(process.cwd(), "app", "icon.png")],
]) {
  await sharp(await icon(size, 0.94, PAGE)).flatten({ background: PAGE }).png().toFile(dest);
}

// The mark on its own, for anywhere it needs to sit on another colour.
await sharp(mark).resize({ height: 512, kernel: "lanczos3" }).png()
  .toFile(path.join(OUT, "mark.png"));
await sharp(await icon(512, 0.72, PAGE_DARK)).png()
  .toFile(path.join(OUT, "icon-512-dark.png"));

console.log(`icons cut from design/logo-source.png (mark ${markMeta.width}x${markMeta.height})`);
