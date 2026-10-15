import { deflateSync } from 'node:zlib';

// A small pixel-letter monogram, matching the existing survival HUD.
export function appIcon(size) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  const glyph = ['011110', '110000', '110000', '110110', '110011', '110011', '011110'];
  const unit = size / 12, left = size / 4, top = size * 5 / 24;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = Math.floor((x - left) / unit), gy = Math.floor((y - top) / unit);
    const ink = gx >= 0 && gx < 6 && gy >= 0 && gy < 7 && glyph[gy][gx] === '1';
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    pixels.set(ink ? [199, 243, 107, 255] : [18, 20, 18, 255], offset);
  }
  const crc = data => {
    let value = 0xffffffff;
    for (const byte of data) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); }
    return (value ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]), result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length); body.copy(result, 4); result.writeUInt32BE(crc(body), result.length - 4); return result;
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
