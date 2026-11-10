import { existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
if (!existsSync(join(root, "dist", "media.html"))) {
  console.error("请先运行 pnpm exec vite build，再运行 pnpm start:media。");
  process.exit(1);
}
const dataDir =
  process.env.OMB_MEDIA_DATA_DIR || join(root, ".media-studio", "data");
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const port = process.env.OMB_PORT || "8810";
const child = spawn(
  process.execPath,
  ["--experimental-strip-types", "server/dev-server.ts"],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      OMB_DATA_DIR: dataDir,
      OMB_LAN: "0",
      OMB_PORT: port,
      OMB_STATIC_DIR: join(root, "dist"),
      OMB_DEV_TRUST_LOCAL_BROWSER: "1",
    },
  },
);
console.log(`稿台：http://127.0.0.1:${port}/media.html\n数据目录：${dataDir}`);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => child.kill(signal));
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
