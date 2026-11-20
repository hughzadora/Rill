import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownContent({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        input: ({ type, checked }) => {
          if (type !== "checkbox") return null;
          return (
            <span>
              <span aria-hidden="true">{checked ? "✓" : "○"}</span>
              <span className="sr-only">{checked ? "已完成" : "待完成"}</span>
            </span>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
