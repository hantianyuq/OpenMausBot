import {
  compileMediaBrief,
  mediaBriefSchema,
  mediaProjectSchema,
} from "../../shared/media-studio.ts";
import { MediaStudioStore } from "../media-studio/store.ts";
import { PASS, type RouteHandler } from "./table.ts";

export function createMediaStudioRoutes(dataDir: string): RouteHandler {
  const store = new MediaStudioStore(dataDir);
  return async ({ req, res, path, method, auth, json, readBody }) => {
    if (path !== "/api/media-studio" && !path.startsWith("/api/media-studio/"))
      return PASS;
    if (!auth.scopes.includes("admin"))
      return json(res, 403, { error: "需要工作区管理员权限。" });
    res.setHeader("cache-control", "no-store");
    if (method === "GET" && path === "/api/media-studio/projects")
      return json(res, 200, store.list());
    const history =
      /^\/api\/media-studio\/projects\/([a-f0-9-]+)\/history$/.exec(path);
    if (method === "GET" && history)
      return json(res, 200, store.history(history[1]!));
    if (method !== "POST")
      return json(res, 405, { error: "method not allowed" });
    if (
      !/^application\/json\b/i.test(String(req.headers["content-type"] ?? ""))
    )
      return json(res, 415, { error: "content-type must be application/json" });
    const body: unknown = await readBody(req, 150000);
    if (path === "/api/media-studio/compile") {
      const brief = mediaBriefSchema.safeParse(body);
      return brief.success
        ? json(res, 200, compileMediaBrief(brief.data))
        : json(res, 400, {
            error: "材料不完整，标题、核查范围、事实和来源均需填写。",
          });
    }
    if (path === "/api/media-studio/projects") {
      const project = mediaProjectSchema.safeParse(body);
      if (!project.success)
        return json(res, 400, {
          error: "内容格式无效或超过长度上限，请检查所有必填项。",
        });
      try {
        return json(res, 200, store.save(project.data));
      } catch (error) {
        if (error instanceof Error && "status" in error)
          return json(res, Number(error.status), { error: error.message });
        throw error;
      }
    }
    return json(res, 404, { error: "not found" });
  };
}
