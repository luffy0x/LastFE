import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isSafeHttpUrl } from "@/features/submissions/schemas";

type SafeMarkdownProps = {
  source: string;
};

export function SafeMarkdown({ source }: SafeMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={(url) => (isSafeHttpUrl(url) ? url : "")}
      components={{
        a: ({ children, ...props }) => (
          <a
            {...props}
            target="_blank"
            rel="nofollow noopener noreferrer"
          >
            {children}
          </a>
        ),
      }}
    >
      {source}
    </ReactMarkdown>
  );
}
