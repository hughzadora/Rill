import { useEffect, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface DocumentLink {
  title: string;
  path: string;
}

function documentRequest(path: string) {
  return "/api/document?path=" + encodeURIComponent(path);
}

function resolveDocumentLink(href: string, active: string) {
  try {
    const base = new URL("/" + active, window.location.origin);
    return new URL(href, base);
  } catch {
    return null;
  }
}

export function DocsPanel({ documents }: { documents: DocumentLink[] }) {
  const [active, setActive] = useState("PRD.md");
  const [loaded, setLoaded] = useState<{
    path: string;
    text: string | null;
    error: boolean;
  } | null>(null);
  const content = loaded?.path === active ? loaded.text : null;
  const error = loaded?.path === active && loaded.error;

  useEffect(() => {
    const controller = new AbortController();
    fetch(documentRequest(active), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Document not available");
        return response.text();
      })
      .then((text) => {
        if (!controller.signal.aborted)
          setLoaded({ path: active, text, error: false });
      })
      .catch((reason) => {
        if (!controller.signal.aborted && reason instanceof Error)
          setLoaded({ path: active, text: null, error: true });
      });
    return () => controller.abort();
  }, [active]);

  const markdownComponents: Components = {
    a: ({ href, children, title }) => {
      if (!href) return <>{children}</>;
      if (href.startsWith("#"))
        return (
          <a href={href} title={title}>
            {children}
          </a>
        );
      const target = resolveDocumentLink(href, active);
      if (!target) return <>{children}</>;
      if (target.origin !== window.location.origin) {
        return (
          <a href={href} title={title}>
            {children}
          </a>
        );
      }

      const path = target.pathname.slice(1);
      if (!documents.some((document) => document.path === path)) {
        return <>{children}</>;
      }

      return (
        <a
          href={documentRequest(path) + target.hash}
          title={title}
          onClick={(event) => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            setActive(path);
          }}
        >
          {children}
        </a>
      );
    },
    input: ({ type, checked }) =>
      type === "checkbox" ? (
        <span>
          <span aria-hidden="true">{checked ? "✓" : "○"}</span>
          <span className="sr-only">{checked ? "已完成" : "待完成"}</span>
        </span>
      ) : null,
  };

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
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {content}
                </ReactMarkdown>
              </div>
            </>
          ) : error ? (
            <div className="empty-state">
              当前文档不可读取。无法从缺失信息推断决策或交接状态。
            </div>
          ) : (
            <output className="small-muted">
              读取受版本控制的工程文档…
            </output>
          )}
        </article>
      </div>
    </div>
  );
}
