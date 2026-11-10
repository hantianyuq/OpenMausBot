import { z } from "zod";

const text = z.string().trim().min(1).max(12000);
export const mediaBriefSchema = z.object({
  title: text.max(160),
  angle: text.max(700),
  scope: text.max(1000),
  facts: z
    .array(z.object({ title: text.max(100), body: text.max(700) }))
    .min(1)
    .max(8),
  sources: z
    .array(
      z.object({
        title: text.max(160),
        url: z.url().refine((v) => /^https?:\/\//.test(v)),
      }),
    )
    .min(1)
    .max(20),
});
export const mediaDraftSchema = z.object({
  xhs: z.object({
    title: text.max(160),
    body: text,
    cards: z
      .array(z.object({ title: text.max(160), body: z.string().max(700) }))
      .min(1)
      .max(9),
  }),
  x: z.object({ thread: z.array(text.max(2000)).min(1).max(20) }),
  wechat: z.object({
    title: text.max(160),
    summary: text.max(500),
    body: text,
  }),
});
export const mediaProjectSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
  brief: mediaBriefSchema,
  draft: mediaDraftSchema,
});
export type MediaBrief = z.infer<typeof mediaBriefSchema>;
export type MediaDraft = z.infer<typeof mediaDraftSchema>;
export type MediaProject = z.infer<typeof mediaProjectSchema>;

export function compileMediaBrief(brief: MediaBrief): MediaDraft {
  const facts = brief.facts.map((f) => `${f.title}\n${f.body}`);
  const sources = brief.sources.map((s) => `${s.title}\n${s.url}`).join("\n\n");
  return {
    xhs: {
      title: brief.title,
      body: `${brief.angle}\n\n${facts.join("\n\n")}\n\n核查范围：${brief.scope}\n\n${sources}\n\n#AI工具 #开源项目 #技术经验`,
      cards: [{ title: brief.title, body: brief.angle }, ...brief.facts],
    },
    x: {
      thread: [
        brief.title + "\n\n" + brief.angle,
        ...facts,
        `核查范围：${brief.scope}\n\n来源：${brief.sources[0]!.url}`,
      ],
    },
    wechat: {
      title: brief.title,
      summary: brief.angle,
      body: `${brief.angle}\n\n${facts.join("\n\n")}\n\n核查范围\n${brief.scope}\n\n参考来源\n${sources}`,
    },
  };
}

const commit =
  "https://github.com/milind-soni/OpenMausBot/blob/f9c25dd2400c62e7e322c894cef32b5203096cbf";
export const openMausBrief: MediaBrief = {
  title: "OpenMausBot：自托管前先看这三件事",
  angle:
    "把 AI 助手装起来只是开始。基于 OpenMausBot 源码调研，我更关心部署路径、许可边界，以及长期运行的成本。",
  scope:
    "基于 v0.1.151 / f9c25dd 的源码调研；本文不包含上游桌面、虚拟机或真实模型调用的实测结论。",
  facts: [
    {
      title: "01 / 改了代码，要用源码构建路径",
      body: "根目录 compose.yaml 的构建上下文是 deploy/local，使用上游预构建镜像。二次开发后，应核对 deploy/docker-compose.yml 的源码构建路径，避免运行的仍是上游版本。",
    },
    {
      title: "02 / 核心开源，企业功能单独看",
      body: "核心代码采用 Apache-2.0；enterprise 目录有独立许可。源码中内置月预算限制受 budgets 授权控制，不能假设普通自托管就能使用所有企业功能。",
    },
    {
      title: "03 / 先跑服务，再开重功能",
      body: "项目支持本地运行和容器部署。浏览器、桌面虚拟机、引擎与模型调用会带来额外资源或费用；配置中的资源上限不等于实际资源消耗，真实成本需要部署后测量。",
    },
  ],
  sources: [
    { title: "源码基线 · 根 Compose", url: `${commit}/compose.yaml` },
    { title: "源码构建 Compose", url: `${commit}/deploy/docker-compose.yml` },
    { title: "许可说明", url: `${commit}/LICENSING.md` },
    { title: "预算实现", url: `${commit}/server/spend.ts` },
  ],
};
