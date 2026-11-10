import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { launchVerificationServer } from "./control-omb.ts";

const {
  OMB_UI_PLAYWRIGHT_CORE: playwrightPath,
  OMB_UI_CHROMIUM: executablePath,
} = process.env;
if (!playwrightPath || !executablePath)
  throw new Error(
    "设置 OMB_UI_PLAYWRIGHT_CORE 和 OMB_UI_CHROMIUM 后运行此隔离验收。",
  );
const { chromium } = createRequire(join(playwrightPath, "package.json"))(
  "playwright-core",
);
const output = resolve(".media-studio/evidence");
mkdirSync(output, { recursive: true });
const fixture = await launchVerificationServer(
  process.env,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  [],
  undefined,
  resolve("dist"),
);
let browser;
try {
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--use-mock-keychain"],
  });
  const page = await browser.newPage({
    viewport: { width: 1536, height: 1024 },
    acceptDownloads: true,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`${fixture.info.url}/media.html`);
  const title = page.getByLabel("标题", { exact: true });
  await title.waitFor();
  await page.locator("canvas").waitFor();
  assert.equal(await title.inputValue(), "OpenMausBot 自托管前必看");
  await page.screenshot({ path: join(output, "desktop.png") });
  await page.getByRole("button", { name: "调研材料", exact: true }).click();
  await page
    .getByLabel("核心观点", { exact: true })
    .fill("基于源码核查：先核对部署路径、许可边界，再评估运行成本。");
  await page
    .getByRole("button", { name: "整理三平台草稿", exact: true })
    .click();
  await page
    .getByRole("button", { name: "确认覆盖三平台草稿", exact: true })
    .click();
  await title.waitFor();
  assert.match(
    await page.getByLabel("正文", { exact: true }).inputValue(),
    /基于源码核查/,
  );
  await title.fill("人工改好的小红书标题");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("已保存 · 版本 1", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "X", exact: true }).click();
  assert.match(
    await page.getByLabel("帖子 1 / 5", { exact: true }).inputValue(),
    /基于源码核查/,
  );
  await page.screenshot({ path: join(output, "x.png") });
  await page.getByRole("tab", { name: "公众号", exact: true }).click();
  await page.getByLabel("摘要", { exact: true }).fill("人工修改的公众号摘要");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("已保存 · 版本 2", { exact: true }).waitFor();
  await page.screenshot({ path: join(output, "wechat.png") });
  await page.reload();
  await title.waitFor();
  assert.equal(await title.inputValue(), "人工改好的小红书标题");
  await page.getByRole("tab", { name: "公众号", exact: true }).click();
  assert.equal(
    await page.getByLabel("摘要", { exact: true }).inputValue(),
    "人工修改的公众号摘要",
  );
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出内容包", exact: true }).click();
  await (await downloaded).saveAs(join(output, "content.zip"));
  await page.getByText("已导出三平台内容包", { exact: true }).waitFor();
  await page.getByRole("button", { name: "版本记录", exact: true }).click();
  await page.getByRole("button", { name: /^恢复 v1/ }).click();
  assert.notEqual(
    await page.getByLabel("摘要", { exact: true }).inputValue(),
    "人工修改的公众号摘要",
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("已保存 · 版本 3", { exact: true }).waitFor();
  const request = async (path, body, options = {}) =>
    fetch(`${fixture.info.url}/api/media-studio/${path}`, {
      headers: {
        origin: fixture.info.url,
        "content-type": "application/json",
        ...options.headers,
      },
      ...(body === undefined
        ? {}
        : { method: "POST", body: JSON.stringify(body) }),
    });
  const projects = await (await request("projects")).json();
  assert.equal(projects.length, 1);
  assert.equal(
    (await request("projects", { ...projects[0], revision: 0 })).status,
    409,
  );
  assert.equal(
    (
      await request("compile", {
        ...projects[0].brief,
        sources: [{ title: "bad", url: "javascript:alert(1)" }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("projects", projects[0], {
        headers: { origin: "https://untrusted.invalid" },
      })
    ).status,
    403,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "小红书", exact: true }).click();
  await page.screenshot({ path: join(output, "mobile.png"), fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    join(output, "verification.json"),
    JSON.stringify(
      {
        passed: true,
        fixture: fixture.info.url,
        title: await page.title(),
        consoleErrors: errors,
        desktop: "1536×1024",
        mobile: "390×844",
        checks: [
          "材料整理",
          "平台切换保留编辑",
          "保存刷新持久化",
          "版本恢复",
          "ZIP 下载",
          "版本冲突拒绝",
          "不可信来源拒绝",
          "跨站写入拒绝",
          "移动端无横向溢出",
        ],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ ok: true, evidence: output }));
} finally {
  await browser?.close();
  await fixture.close();
}
