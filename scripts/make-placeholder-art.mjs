// make-placeholder-art.mjs · 生成占位卡面图（development_only）
// 用法：node scripts/make-placeholder-art.mjs [--out 路径]
// 输出：source/card/卡面图·占位.png（1024×1024，星空夜空渐变 + 星星 + 中元金月 + 祖传玉璧）
// 说明：纯代码确定性绘制（无字体/无 AI），仅为 PNG 打包提供 shell；正式卡面图就位后用
//       node scripts/embed-png.mjs --image 替换重打即可。
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFlag = process.argv.indexOf('--out');
const out = outFlag >= 0 && process.argv[outFlag + 1]
  ? path.resolve(root, process.argv[outFlag + 1])
  : path.join(root, 'source/card/卡面图·占位.png');

const W = 1024, H = 1024;
const px = Buffer.alloc(W * H * 4);

// ---- 像素工具 ----
function setPx(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  if (a === 255) { px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; return; }
  const sa = a / 255, da = px[i + 3] / 255, oa = sa + da * (1 - sa);
  if (oa === 0) return;
  px[i] = Math.round((r * sa + px[i] * da * (1 - sa)) / oa);
  px[i + 1] = Math.round((g * sa + px[i + 1] * da * (1 - sa)) / oa);
  px[i + 2] = Math.round((b * sa + px[i + 2] * da * (1 - sa)) / oa);
  px[i + 3] = Math.round(oa * 255);
}
function fillCircle(cx, cy, r, col, alpha = 1) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 <= r2) setPx(x, y, col[0], col[1], col[2], Math.round(alpha * 255));
    }
  }
}
function ring(cx, cy, rOuter, rInner, col, alpha = 1) {
  for (let y = Math.floor(cy - rOuter); y <= Math.ceil(cy + rOuter); y++) {
    for (let x = Math.floor(cx - rOuter); x <= Math.ceil(cx + rOuter); x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 <= rOuter * rOuter && d2 >= rInner * rInner) setPx(x, y, col[0], col[1], col[2], Math.round(alpha * 255));
    }
  }
}
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- 背景：深靛夜空垂直渐变（#131630 → #0a0d1e → #090b18）----
const stops = [[0x13, 0x16, 0x30], [0x0a, 0x0d, 0x1e], [0x09, 0x0b, 0x18]];
for (let y = 0; y < H; y++) {
  const t = y / (H - 1);
  const seg = t * (stops.length - 1);
  const i = Math.min(Math.floor(seg), stops.length - 2);
  const f = seg - i;
  const [r0, g0, b0] = stops[i], [r1, g1, b1] = stops[i + 1];
  const r = Math.round(r0 + (r1 - r0) * f), g = Math.round(g0 + (g1 - g0) * f), b = Math.round(b0 + (b1 - b0) * f);
  for (let x = 0; x < W; x++) setPx(x, y, r, g, b);
}

// ---- 左下淡紫星云 + 右下金晕（与状态栏同源）----
fillCircle(180, H - 60, 260, [0x7a, 0x6a, 0xc8], 0.07);
fillCircle(140, H - 40, 300, [0x9a, 0x8a, 0xd8], 0.05);
fillCircle(W + 80, H + 60, 380, [0xc9, 0xa2, 0x4f], 0.06);

// ---- 星星（seeded，白/金/蓝三色，呼吸亮度用透明度模拟）----
const rnd = mulberry32(0x5EED);
const stars = [];
for (let i = 0; i < 260; i++) {
  stars.push({
    x: rnd() * W, y: rnd() * H * 0.92,
    r: 0.6 + rnd() * 1.7,
    col: rnd() < 0.55 ? [0xe8, 0xec, 0xf7] : (rnd() < 0.5 ? [0xd9, 0xb3, 0x6a] : [0x93, 0xa4, 0xd8]),
    a: 0.35 + rnd() * 0.6,
  });
}
for (const s of stars) {
  if (s.r < 1) setPx(Math.round(s.x), Math.round(s.y), s.col[0], s.col[1], s.col[2], Math.round(s.a * 255));
  else fillCircle(s.x, s.y, s.r, s.col, s.a);
}

// ---- 中元金月（上部），带光晕 ----
fillCircle(512, 300, 150, [0xf5, 0xe2, 0xb0], 0.10);
fillCircle(512, 300, 118, [0xe8, 0xc9, 0x82], 0.55);
fillCircle(512, 300, 104, [0xf2, 0xdc, 0xa4], 1);
// 月面暗斑（简化）
for (const [dx, dy, r, a] of [[-28, 22, 26, 0.05], [34, -14, 18, 0.04], [10, 48, 14, 0.04]]) fillCircle(512 + dx, 300 + dy, r, [0xbb, 0x9d, 0x66], a);

// ---- 祖传玉佩（下部中央：青玉环 + 金色系带/流苏）----
ring(512, 700, 96, 68, [0x8f, 0xb5, 0xa4], 1);            // 外环
ring(512, 700, 26, 0, [0x0a, 0x0d, 0x1e], 1);             // 中孔（透夜空）
ring(512, 700, 96, 68, [0xd9, 0xb3, 0x6a], 0.35);          // 金描边（叠层内侧）
ring(512, 700, 100, 96, [0xd9, 0xb3, 0x6a], 0.8);          // 外金边
// 顶部系带（金色小扣 + 挂线）
ring(512, 596, 10, 6, [0xd9, 0xb3, 0x6a], 1);
for (let y = 568; y <= 592; y++) setPx(512, y, 0xd9, 0xb3, 0x6a, 200);
// 底部流苏（三股短直线）
for (const fx of [-26, 0, 26]) {
  for (let y = 798; y <= 822; y++) {
    const wob = Math.sin((y - 798) / 24 * Math.PI + fx / 40) * 2;
    setPx(512 + fx + Math.round(wob), y, 0xd9, 0xb3, 0x6a, 220);
  }
}

// ---- 编码 PNG（零依赖：zlib deflate + 手算 CRC32）----
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // color type RGBA
// scanlines：每行前置 filter 字节 0
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}
const png = Buffer.concat([
  PNG_SIG,
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync(out, png);
console.log('输出: ' + path.relative(root, out) + ' (' + png.length + ' bytes, ' + W + '×' + H + ')');
console.log('sha256: ' + crypto.createHash('sha256').update(png).digest('hex'));