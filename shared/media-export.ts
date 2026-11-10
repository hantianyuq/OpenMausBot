import type { MediaDraft } from "./media-studio.ts";

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}

export function wechatHtml(draft: MediaDraft["wechat"]): string {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(draft.title)}</title><body><section style="max-width:677px;margin:0 auto;padding:28px 20px;color:#222;font-family:system-ui,sans-serif;font-size:16px;line-height:1.85;word-break:break-word"><h1 style="font-size:26px;line-height:1.5">${escapeHtml(draft.title)}</h1><p style="color:#777;font-size:14px;border-left:3px solid #d85436;padding-left:14px">${escapeHtml(draft.summary)}</p>${draft.body
    .split(/\n\s*\n/)
    .map(
      (p) =>
        `<p style="margin:22px 0;white-space:pre-wrap">${escapeHtml(p)}</p>`,
    )
    .join("")}</section></body></html>`;
}

const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  return c >>> 0;
});
export function storedZip(
  files: { name: string; data: Uint8Array }[],
): Uint8Array {
  const chunks: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    let crc = 0xffffffff;
    for (const byte of file.data)
      crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255]!;
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x800, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, file.data.length, true);
    l.setUint32(22, file.data.length, true);
    l.setUint16(26, name.length, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, file.data.length, true);
    c.setUint32(24, file.data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.set(name, 46);
    chunks.push(local, file.data);
    directory.push(central);
    offset += local.length + file.data.length;
  }
  const centralSize = directory.reduce((n, v) => n + v.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + 22);
  let at = 0;
  for (const part of [...chunks, ...directory, end]) {
    result.set(part, at);
    at += part.length;
  }
  return result;
}
