import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isSafeHttpUrl } from "@/features/submissions/schemas";

type SafeMarkdownProps = {
  source: string;
};

const ALLOWED_MARKDOWN_ELEMENTS = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
] as const;

export function SafeMarkdown({ source }: SafeMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      allowedElements={ALLOWED_MARKDOWN_ELEMENTS}
      skipHtml
      urlTransform={(url) => url}
      components={{
        a: ({ children, href }) => {
          if (!href || !isSafeHttpUrl(href)) return <>{children}</>;

          return (
            <a
              href={href.trim()}
              target="_blank"
              rel="nofollow noopener noreferrer"
            >
              {children}
            </a>
          );
        },
      }}
    >
      {source}
    </ReactMarkdown>
  );
}
