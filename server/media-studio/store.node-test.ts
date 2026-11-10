import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MediaStudioStore } from "./store.ts";
import { mediaBriefSchema } from "../../shared/media-studio.ts";
import { wechatHtml, storedZip } from "../../shared/media-export.ts";

test("编辑持久化、冲突拒绝与历史恢复不会丢失人工修改", () => {
  const dir = mkdtempSync(join(tmpdir(), "media-studio-store-"));
  try {
    const store = new MediaStudioStore(dir);
    const initial = store.list()[0]!;
    const edited = structuredClone(initial);
    edited.draft.xhs.title = "人工修改的标题";
    const saved = store.save(edited);
    assert.equal(
      new MediaStudioStore(dir).list()[0]!.draft.xhs.title,
      "人工修改的标题",
    );
    assert.throws(() => store.save(initial), /其他窗口/);
    const old = store.history(saved.id)[0]!;
    store.save({ ...old, revision: saved.revision });
    assert.equal(store.list()[0]!.draft.xhs.title, initial.draft.xhs.title);
    assert.equal(store.history(saved.id)[0]!.draft.xhs.title, "人工修改的标题");
    assert.equal(
      mediaBriefSchema.safeParse({
        ...initial.brief,
        sources: [{ title: "bad", url: "javascript:alert(1)" }],
      }).success,
      false,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("公众号导出将不可信内容作为文字，ZIP 保留中文路径和字节", () => {
  const html = wechatHtml({
    title: "<img src=x onerror=alert(1)>",
    summary: "<script>x</script>",
    body: "你好\n\n<script>alert(1)</script>",
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;script&gt;"));
  const content = new TextEncoder().encode("实测内容\n你好");
  const zip = storedZip([{ name: "公众号/文章.txt", data: content }]);
  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  const nameLength = view.getUint16(26, true);
  assert.equal(
    new TextDecoder().decode(zip.slice(30, 30 + nameLength)),
    "公众号/文章.txt",
  );
  assert.deepEqual(
    zip.slice(30 + nameLength, 30 + nameLength + content.length),
    content,
  );
});
