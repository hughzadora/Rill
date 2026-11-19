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
            <span role="img" aria-label={checked ? "已完成" : "待完成"}>
              {checked ? "✓" : "○"}
            </span>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
