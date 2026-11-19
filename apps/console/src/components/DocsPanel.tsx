import { useEffect, useState } from "react";
import { MarkdownContent } from "./MarkdownContent";

interface DocumentLink {
  title: string;
  path: string;
}

export function DocsPanel({ documents }: { documents: DocumentLink[] }) {
  const [active, setActive] = useState("PRD.md");
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setContent(null);
    setError(false);
    fetch("/api/document?path=" + encodeURIComponent(active), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Document not available");
        return response.text();
      })
      .then((text) => setContent(text))
      .catch((reason) => {
        if (reason instanceof Error && reason.name !== "AbortError")
          setError(true);
      });
    return () => controller.abort();
  }, [active]);

  return (
    <div className="page-grid">
      <div className="content-heading">
        <div>
          <p className="eyebrow">CONTEXT / DURABLE ENGINEERING</p>
          <h2>项目文档与开发交接</h2>
          <p>
            规范、产品、架构、管理与交接是 Rill 的正式工程资产。Agent
            的下次会话从这里和 GitHub 继续。
          </p>
        </div>
      </div>
      <div className="document-workspace">
        <nav className="doc-nav" aria-label="工程文档目录">
          <strong>工程目录</strong>
          {documents.map((document) => (
            <button
              key={document.path}
              type="button"
              aria-current={active === document.path ? "page" : undefined}
              onClick={() => setActive(document.path)}
            >
              <span>{document.title}</span>
              <small>{document.path}</small>
            </button>
          ))}
        </nav>
        <article className="document-reading" aria-label="当前工程文档">
          {content !== null ? (
            <>
              <div className="document-source">版本化源码 / {active}</div>
              <div className="markdown-reading long-form">
                <MarkdownContent>{content}</MarkdownContent>
              </div>
            </>
          ) : error ? (
            <div className="empty-state">
              当前文档不可读取。无法从缺失信息推断决策或交接状态。
            </div>
          ) : (
            <p className="small-muted" role="status">
              读取受版本控制的工程文档…
            </p>
          )}
        </article>
      </div>
    </div>
  );
}
