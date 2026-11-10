import type { MediaDraft, MediaProject } from "../../shared/media-studio.ts";

import { storedZip, wechatHtml } from "../../shared/media-export.ts";
export { wechatHtml } from "../../shared/media-export.ts";

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
): string[] {
  return text.split("\n").flatMap((line) => {
    const rows: string[] = [];
    let current = "";
    for (const char of line) {
      if (current && ctx.measureText(current + char).width > width) {
        rows.push(current);
        current = char;
      } else current += char;
    }
    return [...rows, current];
  });
}

export function renderCard(
  card: MediaDraft["xhs"]["cards"][number],
  index: number,
  total: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1080, 1440);
  ctx.fillStyle = "#d85436";
  ctx.fillRect(86, 100, 68, 68);
  let titleSize = index === 0 ? 84 : 68;
  ctx.font = `700 ${titleSize}px system-ui, sans-serif`;
  while (wrap(ctx, card.title, 900).length > 5 && titleSize > 42) {
    titleSize -= 2;
    ctx.font = `700 ${titleSize}px system-ui, sans-serif`;
  }
  const titles = wrap(ctx, card.title, 900);
  ctx.fillStyle = "#1d1d1f";
  const titleTop = index === 0 ? 360 : 270;
  titles.forEach((line, i) =>
    ctx.fillText(line, 86, titleTop + i * titleSize * 1.35),
  );
  const bodyTop = titleTop + titles.length * titleSize * 1.35 + 65;
  let bodySize = 40;
  ctx.font = `400 ${bodySize}px system-ui, sans-serif`;
  while (
    wrap(ctx, card.body, 900).length * bodySize * 1.65 > 1260 - bodyTop &&
    bodySize > 18
  ) {
    bodySize -= 1;
    ctx.font = `400 ${bodySize}px system-ui, sans-serif`;
  }
  const lines = wrap(ctx, card.body, 900);
  if (bodyTop + lines.length * bodySize * 1.65 > 1260)
    throw new Error("图卡文字过长，请缩短后导出。");
  ctx.fillStyle = "#55565a";
  lines.forEach((line, i) =>
    ctx.fillText(line, 86, bodyTop + i * bodySize * 1.65),
  );
  ctx.font = "400 30px system-ui, sans-serif";
  ctx.fillText("调研笔记 · 请结合正文核查来源", 86, 1345);
  ctx.textAlign = "right";
  ctx.fillText(
    `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
    994,
    1345,
  );
  return canvas;
}

const encoder = new TextEncoder();

export async function projectArchive(
  project: MediaProject,
): Promise<Uint8Array> {
  await document.fonts.ready;
  const files = [
    {
      name: "project.json",
      data: encoder.encode(JSON.stringify(project, null, 2)),
    },
    {
      name: "小红书/正文.txt",
      data: encoder.encode(
        project.draft.xhs.title + "\n\n" + project.draft.xhs.body,
      ),
    },
    {
      name: "X/thread.txt",
      data: encoder.encode(
        project.draft.x.thread
          .map((p, i, a) => `${i + 1}/${a.length}\n${p}`)
          .join("\n\n---\n\n"),
      ),
    },
    {
      name: "X/thread.json",
      data: encoder.encode(JSON.stringify(project.draft.x.thread, null, 2)),
    },
    {
      name: "公众号/article.html",
      data: encoder.encode(wechatHtml(project.draft.wechat)),
    },
    {
      name: "公众号/article.md",
      data: encoder.encode(
        `# ${project.draft.wechat.title}\n\n${project.draft.wechat.body}`,
      ),
    },
    {
      name: "来源与范围.txt",
      data: encoder.encode(
        `${project.brief.scope}\n\n${project.brief.sources.map((s) => s.title + "\n" + s.url).join("\n\n")}\n\n稿台首版：材料规则整理，未调用实时模型。导出不代表已发布。`,
      ),
    },
  ];
  for (const [i, card] of project.draft.xhs.cards.entries()) {
    const blob = await new Promise<Blob>((resolve, reject) =>
      renderCard(card, i, project.draft.xhs.cards.length).toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG 导出失败"))),
        "image/png",
      ),
    );
    files.push({
      name: `小红书/${String(i + 1).padStart(2, "0")}.png`,
      data: new Uint8Array(await blob.arrayBuffer()),
    });
  }
  return storedZip(files);
}

export function download(data: Uint8Array, name: string) {
  const blob = new Blob([new Uint8Array(data)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
