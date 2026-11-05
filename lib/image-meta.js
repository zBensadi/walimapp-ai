// WalimApp AI — dependency-free image dimension parser.
// Extracts { width, height } from JPEG, PNG and WebP buffers so panorama
// uploads can be validated as equirectangular (~2:1) without native deps.
// Returns null when the buffer is not a recognized/supported image.
'use strict';

function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let off = 2;
  while (off + 4 <= buf.length) {
    if (buf[off] !== 0xff) {
      off += 1;
      continue;
    }
    const marker = buf[off + 1];
    // Standalone markers: SOI/EOI/RSTn/TEM.
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      off += 2;
      continue;
    }
    if (off + 4 > buf.length) return null;
    const len = buf.readUInt16BE(off + 2);
    if (len < 2 || off + 2 + len > buf.length) return null;
    // SOF0/SOF1/SOF2 (baseline/extended/progressive): height + width follow.
    if ((marker === 0xc0 || marker === 0xc1 || marker === 0xc2) && len >= 7) {
      const height = buf.readUInt16BE(off + 5);
      const width = buf.readUInt16BE(off + 7);
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    off += 2 + len;
  }
  return null;
}

function pngSize(buf) {
  // 8-byte signature + IHDR chunk: width @16..19, height @20..23 (BE).
  if (buf.length < 26) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i += 1) {
    if (buf[i] !== sig[i]) return null;
  }
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (!width || !height) return null;
  return { width, height };
}

function webpSize(buf) {
  // RIFF....WEBP + VP8/VP8L/VP8X chunk.
  if (buf.length < 16) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fourcc = buf.toString('ascii', 12, 16);
  if (fourcc === 'VP8 ') {
    // Lossy: chunk header (8B) + 3B frame tag + 3B start code, then 14-bit w/h.
    if (buf.length < 30) return null;
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    if (!width || !height) return null;
    return { width, height };
  }
  if (fourcc === 'VP8L') {
    // Lossless: 1B signature (0x2f) + 4B packed 14-bit (w-1),(h-1) LE.
    if (buf.length < 25 || buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  if (fourcc === 'VP8X') {
    // Extended: canvas (w-1),(h-1) as 24-bit LE at chunk-data+4/+7.
    if (buf.length < 30) return null;
    const width = buf.readUIntLE(24, 3) + 1;
    const height = buf.readUIntLE(27, 3) + 1;
    return { width, height };
  }
  return null;
}

function imageSize(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  return jpegSize(buf) || pngSize(buf) || webpSize(buf);
}

module.exports = { imageSize, jpegSize, pngSize, webpSize };
