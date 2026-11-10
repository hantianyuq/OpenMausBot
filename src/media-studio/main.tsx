import { StrictMode, useEffect, useId, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  compileMediaBrief,
  openMausBrief,
  type MediaProject,
  type MediaDraft,
} from "../../shared/media-studio";
import { download, projectArchive, renderCard, wechatHtml } from "./export";
import "./studio.css";

type Platform = "xhs" | "x" | "wechat";
const names: Record<Platform, string> = {
  xhs: "小红书",
  x: "X",
  wechat: "公众号",
};
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/media-studio/${path}`, {
    credentials: "same-origin",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? `请求失败：${response.status}`);
  return data as T;
}

function CardPreview({
  card,
  index,
  total,
}: {
  card: MediaDraft["xhs"]["cards"][number];
  index: number;
  total: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void document.fonts.ready.then(() => {
      if (!active) return;
      try {
        holder.current?.replaceChildren(renderCard(card, index, total));
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "预览失败");
      }
    });
    return () => {
      active = false;
    };
  }, [card, index, total]);
  return (
    <>
      <div
        className="ms-card"
        ref={holder}
        aria-label={`第 ${index + 1} 张图卡预览`}
      />
      {error && <p role="alert">{error}</p>}
    </>
  );
}

function Studio() {
  const [projects, setProjects] = useState<MediaProject[]>([]);
  const [project, setProject] = useState<MediaProject | null>(null);
  const [platform, setPlatform] = useState<Platform>("xhs");
  const [view, setView] = useState<"editor" | "sources">("editor");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("正在读取内容项目…");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<MediaProject[] | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [confirmCompile, setConfirmCompile] = useState(false);
  useEffect(() => {
    void api<MediaProject[]>("projects")
      .then((rows) => {
        setProjects(rows);
        setProject(rows[0] ?? null);
        setMessage("已载入调研材料");
      })
      .catch((e) => {
        setError(String(e.message));
        setMessage("");
      });
  }, []);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function edit(next: MediaProject) {
    setProject(next);
    setDirty(true);
    setError("");
    setConfirmCompile(false);
  }
  function updateDraft(partial: Partial<MediaDraft>) {
    if (project) edit({ ...project, draft: { ...project.draft, ...partial } });
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!project) return;
    await run(async () => {
      const saved = await api<MediaProject>("projects", project);
      setProject(saved);
      setProjects((rows) => [saved, ...rows.filter((p) => p.id !== saved.id)]);
      setDirty(false);
      setMessage(`已保存 · 版本 ${saved.revision}`);
    });
  }
  const activeDraft = project?.draft;
  return (
    <div className="ms-app">
      <aside className="ms-sidebar">
        <a className="ms-logo" href="/media.html">
          稿台<span>内容工作台</span>
        </a>
        <nav aria-label="工作台导航">
          <button
            className={view === "editor" ? "active" : ""}
            onClick={() => setView("editor")}
          >
            <Icon type="document" />
            内容项目
          </button>
          <button
            className={view === "sources" ? "active" : ""}
            onClick={() => setView("sources")}
          >
            <Icon type="layers" />
            调研材料
          </button>
        </nav>
        <div className="ms-projects">
          <p>我的项目</p>
          {projects.map((p) => (
            <button
              key={p.id}
              disabled={dirty || busy}
              className={project?.id === p.id ? "selected" : ""}
              onClick={() => {
                setProject(p);
                setCardIndex(0);
                setHistory(null);
              }}
            >
              {p.brief.title}
            </button>
          ))}
          <button
            disabled={dirty || busy}
            onClick={() => {
              const brief = {
                ...openMausBrief,
                title: "新内容项目",
                angle: "在调研材料中填写你的核心观点。",
              };
              setProject({
                id: crypto.randomUUID(),
                revision: 0,
                updatedAt: new Date().toISOString(),
                brief,
                draft: compileMediaBrief(brief),
              });
              setDirty(true);
              setView("sources");
              setHistory(null);
              setCardIndex(0);
            }}
          >
            ＋ 新建项目
          </button>
        </div>
        <a className="ms-base" href="/" target="_blank" rel="noreferrer">
          基于 OpenMausBot <span>↗</span>
        </a>
      </aside>
      <main>
        <header className="ms-header">
          <h1>{project?.brief.title ?? "内容工作台"}</h1>
          <div>
            <button
              disabled={!project || busy || !dirty}
              onClick={() => void save()}
            >
              保存
            </button>
            <button
              className="primary"
              disabled={!project || busy}
              onClick={() =>
                void run(async () => {
                  download(await projectArchive(project!), "稿台-内容包.zip");
                  setMessage(
                    dirty
                      ? "已导出当前编辑内容；尚未保存到项目"
                      : "已导出三平台内容包",
                  );
                })
              }
            >
              导出内容包
            </button>
          </div>
        </header>
        <div className="ms-status" aria-live="polite">
          <span>{dirty ? "有未保存的修改" : message}</span>
          <span>材料规则整理 · 模型未接入</span>
        </div>
        {error && (
          <div className="ms-error" role="alert">
            {error}
            <button onClick={() => setError("")}>关闭</button>
          </div>
        )}
        {!project || !activeDraft ? (
          <div className="ms-empty">
            {error
              ? "服务尚未连接，请检查本地 OpenMausBot 是否启动。"
              : "正在加载…"}
          </div>
        ) : (
          <>
            <div className="ms-tabs" role="tablist" aria-label="内容平台">
              {(Object.keys(names) as Platform[]).map((key) => (
                <button
                  role="tab"
                  aria-selected={platform === key && view === "editor"}
                  key={key}
                  onClick={() => {
                    setPlatform(key);
                    setView("editor");
                  }}
                >
                  {names[key]}
                </button>
              ))}
              <button
                className="ms-history"
                onClick={() =>
                  void run(async () =>
                    setHistory(
                      await api<MediaProject[]>(
                        `projects/${project.id}/history`,
                      ),
                    ),
                  )
                }
              >
                版本记录
              </button>
            </div>
            {history && (
              <section className="ms-history-panel">
                <h2>保存历史</h2>
                <button onClick={() => setHistory(null)}>收起</button>
                {history.length === 0 ? (
                  <p>保存修改后会保留最近 30 个版本。</p>
                ) : (
                  history.map((p) => (
                    <button
                      key={p.revision}
                      onClick={() => {
                        edit({ ...p, revision: project.revision });
                        setHistory(null);
                        setCardIndex(0);
                        setMessage("已恢复到编辑区，保存后生效");
                      }}
                    >
                      恢复 v{p.revision} ·{" "}
                      {new Date(p.updatedAt).toLocaleString("zh-CN")}
                    </button>
                  ))
                )}
              </section>
            )}
            {view === "sources" ? (
              <section className="ms-materials">
                <div className="ms-section-heading">
                  <div>
                    <h2>调研材料</h2>
                    <p>事实、观点和来源先整理清楚，再生成平台草稿。</p>
                  </div>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => {
                      if (!confirmCompile) {
                        setConfirmCompile(true);
                        return;
                      }
                      void run(async () => {
                        const draft = await api<MediaDraft>(
                          "compile",
                          project.brief,
                        );
                        edit({ ...project, draft });
                        setCardIndex(0);
                        setView("editor");
                        setMessage("已按材料整理三平台草稿");
                      });
                    }}
                  >
                    {confirmCompile ? "确认覆盖三平台草稿" : "整理三平台草稿"}
                  </button>
                </div>
                {confirmCompile && (
                  <p className="ms-notice">
                    此操作会覆盖当前三平台草稿。需要保留的修改请先保存，可通过版本记录恢复。
                  </p>
                )}
                <Field
                  label="项目标题"
                  value={project.brief.title}
                  onChange={(title) =>
                    edit({ ...project, brief: { ...project.brief, title } })
                  }
                />
                <Field
                  label="核心观点"
                  area
                  value={project.brief.angle}
                  onChange={(angle) =>
                    edit({ ...project, brief: { ...project.brief, angle } })
                  }
                />
                <Field
                  label="核查范围"
                  area
                  value={project.brief.scope}
                  onChange={(scope) =>
                    edit({ ...project, brief: { ...project.brief, scope } })
                  }
                />
                {project.brief.facts.map((fact, i) => (
                  <div className="ms-fact" key={i}>
                    <Field
                      label={`事实 ${i + 1} · 标题`}
                      value={fact.title}
                      onChange={(title) =>
                        edit({
                          ...project,
                          brief: {
                            ...project.brief,
                            facts: project.brief.facts.map((f, n) =>
                              n === i ? { ...f, title } : f,
                            ),
                          },
                        })
                      }
                    />
                    <Field
                      label={`事实 ${i + 1} · 依据`}
                      area
                      value={fact.body}
                      onChange={(body) =>
                        edit({
                          ...project,
                          brief: {
                            ...project.brief,
                            facts: project.brief.facts.map((f, n) =>
                              n === i ? { ...f, body } : f,
                            ),
                          },
                        })
                      }
                    />
                    <button
                      disabled={project.brief.facts.length === 1}
                      onClick={() =>
                        edit({
                          ...project,
                          brief: {
                            ...project.brief,
                            facts: project.brief.facts.filter(
                              (_, n) => n !== i,
                            ),
                          },
                        })
                      }
                    >
                      删除事实 {i + 1}
                    </button>
                  </div>
                ))}
                <button
                  disabled={project.brief.facts.length >= 8}
                  onClick={() =>
                    edit({
                      ...project,
                      brief: {
                        ...project.brief,
                        facts: [
                          ...project.brief.facts,
                          { title: "新事实", body: "填写已核查的内容" },
                        ],
                      },
                    })
                  }
                >
                  ＋ 添加事实
                </button>
                <Field
                  label="参考来源（每行一个 http / https 链接）"
                  area
                  value={project.brief.sources.map((s) => s.url).join("\n")}
                  onChange={(value) =>
                    edit({
                      ...project,
                      brief: {
                        ...project.brief,
                        sources: value
                          .split("\n")
                          .filter(Boolean)
                          .map((url, i) => ({
                            title:
                              project.brief.sources[i]?.title ??
                              `来源 ${i + 1}`,
                            url,
                          })),
                      },
                    })
                  }
                />
              </section>
            ) : (
              <div className="ms-workspace">
                <section
                  className="ms-editor"
                  aria-label={`${names[platform]}编辑区`}
                >
                  {platform === "xhs" && (
                    <>
                      <Field
                        label="标题"
                        value={activeDraft.xhs.title}
                        onChange={(title) =>
                          updateDraft({ xhs: { ...activeDraft.xhs, title } })
                        }
                      />
                      <p className="ms-hint">
                        {Array.from(activeDraft.xhs.title).length} 字 ·
                        建议控制在 20 字以内
                      </p>
                      <Field
                        label="正文"
                        area
                        tall
                        value={activeDraft.xhs.body}
                        onChange={(body) =>
                          updateDraft({ xhs: { ...activeDraft.xhs, body } })
                        }
                      />
                      <details className="ms-card-editor">
                        <summary>
                          编辑图卡文字 · {activeDraft.xhs.cards.length} 张
                        </summary>
                        {activeDraft.xhs.cards.map((card, i) => (
                          <div key={i}>
                            <Field
                              label={`图卡 ${i + 1} 标题`}
                              value={card.title}
                              onChange={(title) =>
                                updateDraft({
                                  xhs: {
                                    ...activeDraft.xhs,
                                    cards: activeDraft.xhs.cards.map((c, n) =>
                                      n === i ? { ...c, title } : c,
                                    ),
                                  },
                                })
                              }
                            />
                            <Field
                              label={`图卡 ${i + 1} 正文`}
                              area
                              value={card.body}
                              onChange={(body) =>
                                updateDraft({
                                  xhs: {
                                    ...activeDraft.xhs,
                                    cards: activeDraft.xhs.cards.map((c, n) =>
                                      n === i ? { ...c, body } : c,
                                    ),
                                  },
                                })
                              }
                            />
                          </div>
                        ))}
                      </details>
                    </>
                  )}
                  {platform === "x" && (
                    <>
                      <h2>Thread 正文</h2>
                      <p className="ms-hint">
                        每段一条，可独立编辑。计数为 Unicode
                        字符数，发布前需按账号限制检查。
                      </p>
                      {activeDraft.x.thread.map((post, i) => (
                        <div className="ms-thread-field" key={i}>
                          <Field
                            label={`帖子 ${i + 1} / ${activeDraft.x.thread.length}`}
                            area
                            value={post}
                            onChange={(text) =>
                              updateDraft({
                                x: {
                                  thread: activeDraft.x.thread.map((p, n) =>
                                    n === i ? text : p,
                                  ),
                                },
                              })
                            }
                          />
                          <p className="ms-hint">
                            {Array.from(post).length} 字符{" "}
                            <button
                              disabled={activeDraft.x.thread.length === 1}
                              onClick={() =>
                                updateDraft({
                                  x: {
                                    thread: activeDraft.x.thread.filter(
                                      (_, n) => n !== i,
                                    ),
                                  },
                                })
                              }
                            >
                              删除
                            </button>
                          </p>
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          updateDraft({
                            x: { thread: [...activeDraft.x.thread, "新帖子"] },
                          })
                        }
                      >
                        ＋ 添加帖子
                      </button>
                    </>
                  )}
                  {platform === "wechat" && (
                    <>
                      <Field
                        label="标题"
                        value={activeDraft.wechat.title}
                        onChange={(title) =>
                          updateDraft({
                            wechat: { ...activeDraft.wechat, title },
                          })
                        }
                      />
                      <Field
                        label="摘要"
                        area
                        value={activeDraft.wechat.summary}
                        onChange={(summary) =>
                          updateDraft({
                            wechat: { ...activeDraft.wechat, summary },
                          })
                        }
                      />
                      <Field
                        label="正文（空行分段）"
                        area
                        tall
                        value={activeDraft.wechat.body}
                        onChange={(body) =>
                          updateDraft({
                            wechat: { ...activeDraft.wechat, body },
                          })
                        }
                      />
                      <button
                        onClick={() =>
                          void run(async () => {
                            const html = wechatHtml(activeDraft.wechat);
                            const doc = new DOMParser().parseFromString(
                              html,
                              "text/html",
                            );
                            await navigator.clipboard.write([
                              new ClipboardItem({
                                "text/html": new Blob([doc.body.innerHTML], {
                                  type: "text/html",
                                }),
                                "text/plain": new Blob([doc.body.innerText], {
                                  type: "text/plain",
                                }),
                              }),
                            ]);
                            setMessage(
                              "已复制公众号排版，可粘贴到编辑器；平台可能调整样式",
                            );
                          })
                        }
                      >
                        复制公众号排版
                      </button>
                    </>
                  )}
                  <div className="ms-sources">
                    <h2>调研来源</h2>
                    {project.brief.sources.map((s, i) => (
                      <a
                        href={/^https?:\/\//.test(s.url) ? s.url : undefined}
                        target="_blank"
                        rel="noreferrer"
                        key={i}
                      >
                        {s.title} ↗
                      </a>
                    ))}
                    <p>核查范围：{project.brief.scope}</p>
                    <button onClick={() => setView("sources")}>
                      编辑调研材料
                    </button>
                  </div>
                </section>
                <section
                  className="ms-preview"
                  aria-label={`${names[platform]}预览`}
                >
                  <div className="ms-preview-heading">
                    <h2>
                      {names[platform]}预览{platform === "xhs" ? "（3:4）" : ""}
                    </h2>
                    <span>随编辑更新</span>
                  </div>
                  {platform === "xhs" && (
                    <>
                      <CardPreview
                        card={
                          activeDraft.xhs.cards[
                            Math.min(
                              cardIndex,
                              activeDraft.xhs.cards.length - 1,
                            )
                          ]!
                        }
                        index={Math.min(
                          cardIndex,
                          activeDraft.xhs.cards.length - 1,
                        )}
                        total={activeDraft.xhs.cards.length}
                      />
                      <div className="ms-pagination">
                        {activeDraft.xhs.cards.map((_, i) => (
                          <button
                            aria-label={`预览图卡 ${i + 1}`}
                            aria-pressed={cardIndex === i}
                            key={i}
                            onClick={() => setCardIndex(i)}
                          >
                            {String(i + 1).padStart(2, "0")}
                          </button>
                        ))}
                      </div>
                      <p className="ms-hint">
                        导出与预览使用同一张 1080 × 1440 PNG。
                      </p>
                    </>
                  )}
                  {platform === "x" && (
                    <div className="ms-thread-preview">
                      {activeDraft.x.thread.map((post, i) => (
                        <article key={i}>
                          <div className="ms-avatar">H</div>
                          <div>
                            <strong>
                              我的内容账号{" "}
                              <span>
                                @your_handle · {i + 1}/
                                {activeDraft.x.thread.length}
                              </span>
                            </strong>
                            <p>{post}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  {platform === "wechat" && (
                    <iframe
                      title="公众号文章排版预览"
                      sandbox=""
                      srcDoc={wechatHtml(activeDraft.wechat)}
                    />
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  area = false,
  tall = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  area?: boolean;
  tall?: boolean;
}) {
  const id = useId();
  return (
    <div className="ms-field">
      <label htmlFor={id}>{label}</label>
      {area ? (
        <textarea
          id={id}
          className={tall ? "tall" : ""}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
function Icon({ type }: { type: "document" | "layers" }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === "document" ? (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </>
      ) : (
        <>
          <path d="m12 3 10 6-10 6L2 9l10-6ZM2 13l10 6 10-6M2 17l10 6 10-6" />
        </>
      )}
    </svg>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Studio />
  </StrictMode>,
);
