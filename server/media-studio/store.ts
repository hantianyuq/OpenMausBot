import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeFileAtomic } from "../atomic.ts";
import {
  compileMediaBrief,
  mediaProjectSchema,
  openMausBrief,
  type MediaProject,
} from "../../shared/media-studio.ts";

export class MediaStudioStore {
  private file: string;
  constructor(dataDir: string) {
    const dir = join(dataDir, "media-studio");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.file = join(dir, "projects.json");
    if (!existsSync(this.file)) {
      const draft = compileMediaBrief(openMausBrief);
      draft.xhs.title = "OpenMausBot 自托管前必看";
      draft.xhs.cards[0]!.title = "自托管 AI 助手\n先看这 3 件事";
      const project = {
        id: randomUUID(),
        revision: 0,
        updatedAt: new Date().toISOString(),
        brief: openMausBrief,
        draft,
      };
      this.write([{ project, history: [] }]);
    }
  }
  private read(): { project: MediaProject; history: MediaProject[] }[] {
    const rows = JSON.parse(readFileSync(this.file, "utf8")) as {
      project: unknown;
      history: unknown[];
    }[];
    return rows.map((row) => ({
      project: mediaProjectSchema.parse(row.project),
      history: row.history.map((p) => mediaProjectSchema.parse(p)),
    }));
  }
  private write(rows: { project: MediaProject; history: MediaProject[] }[]) {
    writeFileAtomic(this.file, JSON.stringify(rows, null, 2), { mode: 0o600 });
  }
  list() {
    return this.read().map((row) => row.project);
  }
  history(id: string) {
    return this.read().find((row) => row.project.id === id)?.history ?? [];
  }
  save(project: MediaProject): MediaProject {
    const rows = this.read();
    const row = rows.find((r) => r.project.id === project.id);
    if (row && row.project.revision !== project.revision)
      throw Object.assign(
        new Error("此项目已在其他窗口更新，请刷新后重新编辑。"),
        { status: 409 },
      );
    if (!row && project.revision !== 0)
      throw Object.assign(new Error("新项目版本无效。"), { status: 400 });
    const saved = {
      ...project,
      revision: project.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    if (row) {
      row.history = [row.project, ...row.history].slice(0, 30);
      row.project = saved;
    } else {
      rows.push({ project: saved, history: [] });
    }
    this.write(rows);
    return saved;
  }
}
