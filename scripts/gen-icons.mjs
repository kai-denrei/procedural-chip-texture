// Tiny dependency-free PNG icon generator.
//
// Writes 192/512/maskable-512/apple-touch-180 PNGs into public/icons/ with a
// simple chip-pad-grid + 'IC' glyph design — matches the dark + amber palette
// of the running app. Run with: `node scripts/gen-icons.mjs`.
//
// Recorded as a dead end (placeholder approach) in .deban/roles/devops.md —
// post-v1 we should generate icons by running the chip generator on a
// fixed seed and cropping the result.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

// Pure-JS PNG encoder for an RGBA raster.
function encodePng(width, height, rgba) {
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // Add filter byte (0) per scanline
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Color helpers
const rgb = (r, g, b, a = 255) => [r, g, b, a];
const COLORS = {
  bg:      rgb(10, 13, 17),
  bgInner: rgb(18, 24, 32),
  pad:     rgb(201, 169, 106),
  padDim:  rgb(120, 100, 60),
  m1:      rgb(154, 184, 214),
  m2:      rgb(216, 184, 106),
  glyph:   rgb(232, 228, 216),
};

function drawIcon(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = c[0]; buf[i+1] = c[1]; buf[i+2] = c[2]; buf[i+3] = c[3];
  };
  const fillRect = (x0, y0, w, h, c) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c);
  };
  // Safe area: for maskable, art must fit inside the centered 80% circle/square.
  const inset = maskable ? Math.floor(size * 0.1) : 0;
  // Background
  fillRect(0, 0, size, size, COLORS.bg);
  // Die area (inset)
  const dx = Math.floor(size * 0.10) + inset;
  const dy = Math.floor(size * 0.10) + inset;
  const dw = size - 2 * dx;
  const dh = size - 2 * dy;
  fillRect(dx, dy, dw, dh, COLORS.bgInner);
  // Pad ring
  const padSize = Math.max(2, Math.floor(size * 0.03));
  const padGap = Math.max(1, Math.floor(padSize * 0.6));
  const ringInset = Math.floor(size * 0.04) + inset;
  const drawPad = (x, y) => fillRect(x, y, padSize, padSize, COLORS.pad);
  // top + bottom
  for (let x = dx + ringInset; x + padSize <= dx + dw - ringInset; x += padSize + padGap) {
    drawPad(x, dy + ringInset);
    drawPad(x, dy + dh - ringInset - padSize);
  }
  for (let y = dy + ringInset + padSize + padGap; y + padSize <= dy + dh - ringInset - padSize - padGap; y += padSize + padGap) {
    drawPad(dx + ringInset, y);
    drawPad(dx + dw - ringInset - padSize, y);
  }
  // Inner routing grid — horizontal M1 lines + vertical M2 lines (sparse)
  const innerX = dx + ringInset + padSize + padGap * 2;
  const innerY = dy + ringInset + padSize + padGap * 2;
  const innerW = dw - 2 * (ringInset + padSize + padGap * 2);
  const innerH = dh - 2 * (ringInset + padSize + padGap * 2);
  const lineW = Math.max(1, Math.floor(size * 0.006));
  const pitch = Math.max(3, Math.floor(size * 0.05));
  for (let y = innerY; y < innerY + innerH; y += pitch) {
    fillRect(innerX, y, innerW, lineW, COLORS.m1);
  }
  for (let x = innerX + Math.floor(pitch / 2); x < innerX + innerW; x += pitch) {
    fillRect(x, innerY, lineW, innerH, COLORS.m2);
  }
  // "IC" glyph in the center (block-letter-style, antialiasing-free)
  const glyphH = Math.floor(size * 0.45);
  const glyphW = Math.floor(glyphH * 0.9);
  const gx = Math.floor((size - glyphW) / 2);
  const gy = Math.floor((size - glyphH) / 2);
  const stroke = Math.max(2, Math.floor(size * 0.045));
  // 'I' — left half
  const iW = Math.floor(glyphW * 0.34);
  // top bar
  fillRect(gx, gy, iW, stroke, COLORS.glyph);
  // bottom bar
  fillRect(gx, gy + glyphH - stroke, iW, stroke, COLORS.glyph);
  // vertical stem
  fillRect(gx + Math.floor(iW / 2) - Math.floor(stroke / 2), gy, stroke, glyphH, COLORS.glyph);
  // 'C' — right half (open-right square)
  const cX = gx + iW + Math.floor(glyphW * 0.08);
  const cW = glyphW - iW - Math.floor(glyphW * 0.08);
  // left vertical
  fillRect(cX, gy, stroke, glyphH, COLORS.glyph);
  // top
  fillRect(cX, gy, cW, stroke, COLORS.glyph);
  // bottom
  fillRect(cX, gy + glyphH - stroke, cW, stroke, COLORS.glyph);

  return encodePng(size, size, buf);
}

const targets = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable.png', size: 512, maskable: true },
  { name: 'apple-touch-icon-180.png', size: 180, maskable: false },
  { name: 'favicon-32.png', size: 32, maskable: false },
];

for (const t of targets) {
  const png = drawIcon(t.size, { maskable: t.maskable });
  const outPath = path.join(outDir, t.name);
  fs.writeFileSync(outPath, png);
  console.log(`[icons] ${t.name} (${t.size}x${t.size})`);
}
