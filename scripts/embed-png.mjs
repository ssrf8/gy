// embed-png.mjs · 把角色卡 JSON 嵌入 PNG（chara + ccv3 双 chunk，发布用）
// 用法：node scripts/embed-png.mjs [--card artifacts/中元特供·关公.json] [--image 卡面图.png] [--out artifacts/中元特供·关公.png]
// 铁律：只读源（JSON + 卡面图）；chara/ccv3 之外的 PNG chunk 原样保留；嵌入后回读校验语义相等。
// 实现依据：STDB A2 §5（tEXt chunk，值 = JSON UTF-8 → Base64，插 IEND 前；读取时 tEXt 优先）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : fallback;
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cardPath = arg('--card', path.join(root, 'artifacts/中元特供·关公.json'));
const imagePath = arg('--image', path.join(root, 'source/card/卡面图·占位.png'));
const outPath = arg('--out', path.join(root, 'artifacts/中元特供·关公.png'));

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
function parseChunks(buf) {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('不是合法 PNG（签名不符）');
  const chunks = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len), offset: off });
    off += 12 + len;
    if (type === 'IEND') break;
  }
  return chunks;
}
function tEXtValue(data) {
  const z = data.indexOf(0);
  if (z < 0) return null;
  return { keyword: data.toString('latin1', 0, z), text: data.toString('latin1', z + 1) };
}
function isDeepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => isDeepEqual(v, b[i]));
  }
  if (typeof a === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && isDeepEqual(a[k], b[k]));
  }
  return false;
}

// ---- 读入 ----
const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
const shell = fs.readFileSync(imagePath);
if (card.spec !== 'chara_card_v2') throw new Error('卡 JSON spec 不是 chara_card_v2: ' + card.spec);

// ---- 构造 payload ----
const b64 = Buffer.from(JSON.stringify(card), 'utf8').toString('base64');
const v3 = { ...card, spec: 'chara_card_v3', spec_version: '3.0' };
const b64v3 = Buffer.from(JSON.stringify(v3), 'utf8').toString('base64');

// ---- 重写 chunk 序列：删除旧 chara/ccv3（tEXt 内 keyword 命中），IEND 前插入新值 ----
const chunks = parseChunks(shell);
const kept = chunks.filter((c) => {
  if (c.type !== 'tEXt') return true;
  const t = tEXtValue(c.data);
  return !(t && (t.keyword === 'chara' || t.keyword === 'ccv3'));
});
if (kept.length !== chunks.length) console.log('已替换旧嵌入 chunk: ' + chunks.length + ' → ' + kept.length);
const iend = kept.pop();
if (!iend || iend.type !== 'IEND') throw new Error('PNG 缺 IEND');
const textChunk = (keyword, text) => chunk('tEXt', Buffer.concat([Buffer.from(keyword + '\0', 'latin1'), Buffer.from(text, 'latin1')]));
const out = Buffer.concat([
  shell.subarray(0, 8),
  ...kept.map((c) => chunk(c.type, c.data)),
  textChunk('chara', b64),
  textChunk('ccv3', b64v3),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync(outPath, out);

// ---- 回读校验 ----
const back = parseChunks(out);
const payloads = {};
for (const c of back) {
  if (c.type === 'tEXt') {
    const t = tEXtValue(c.data);
    if (t && (t.keyword === 'chara' || t.keyword === 'ccv3')) {
      payloads[t.keyword] = JSON.parse(Buffer.from(t.text, 'base64').toString('utf8'));
    }
  }
}
if (!payloads.chara) throw new Error('回读失败：无 chara payload');
if (!isDeepEqual(payloads.chara, card)) throw new Error('回读失败：chara payload 与源 JSON 语义不等');
if (!payloads.ccv3 || payloads.ccv3.spec !== 'chara_card_v3' || payloads.ccv3.spec_version !== '3.0') throw new Error('回读失败：ccv3 payload 异常');
if (!isDeepEqual({ ...payloads.ccv3, spec: card.spec, spec_version: card.spec_version }, card)) throw new Error('回读失败：ccv3 payload 与源 JSON 语义不等');
const otherChunks = back.filter((c) => c.type !== 'chara' && c.type !== 'ccv3' && c.type !== 'IEND').length;
console.log('输出: ' + path.relative(root, outPath) + ' (' + out.length + ' bytes)');
console.log('chunk 盘点: 总 ' + back.length + ' | 保留非嵌入 chunk ' + otherChunks + '（IHDR/IDAT 等）| chara + ccv3 各 1');
console.log('回读: chara=' + (payloads.chara.data.name) + ' v' + payloads.chara.data.character_version + '，与源 JSON 语义相等 ✓');
console.log('sha256: ' + crypto.createHash('sha256').update(out).digest('hex'));