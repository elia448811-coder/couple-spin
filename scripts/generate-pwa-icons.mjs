/**
 * Generates solid brand PNG icons (192/512/maskable/apple) without extra deps.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(root, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(size, { pad = 0, bg = [16, 7, 31], fg = [196, 92, 255] } = {}) {
  const rows = [];
  const inner = size - pad * 2;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const inSafe = x >= pad && x < size - pad && y >= pad && y < size - pad;
      const cx = x - pad - inner / 2;
      const cy = y - pad - inner / 2;
      const r = Math.sqrt(cx * cx + cy * cy);
      const onMark = inSafe && r < inner * 0.28;
      const color = onMark ? fg : bg;
      const o = 1 + x * 3;
      row[o] = color[0];
      row[o + 1] = color[1];
      row[o + 2] = color[2];
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const files = [
  ['pwa-192.png', png(192)],
  ['pwa-512.png', png(512)],
  ['pwa-maskable-512.png', png(512, { pad: 80 })],
  ['apple-touch-icon.png', png(180)],
];

for (const [name, data] of files) {
  writeFileSync(join(root, name), data);
  console.log('wrote', name, data.length);
}
