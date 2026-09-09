"use client";

import {
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { isSafeHttpUrl } from "@/utils/url";

type MarkdownRenderProps = {
  content: string;
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

function withoutMarkdownNode<Props extends { node?: unknown }>(props: Props) {
  const { node, ...elementProps } = props;
  void node;
  return elementProps;
}

function textFromReactNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) return node.map(textFromReactNode).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textFromReactNode(node.props.children);
  }

  return "";
}

function MarkdownCodeBlock(props: ComponentPropsWithoutRef<"pre">) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const codeId = useId();
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copyCode() {
    try {
      const code = textFromReactNode(props.children).replace(/\n$/, "");
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }

    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState("idle"), 1_800);
  }

  const buttonLabel =
    copyState === "copied"
      ? "已复制"
      : copyState === "failed"
        ? "复制失败"
        : "复制代码";

  return (
    <div className="markdown-render__code-block">
      <div className="markdown-render__block-toolbar">
        <span className="markdown-render__block-label">CODE</span>
        <div className="markdown-render__code-actions">
          <button
            type="button"
            className="markdown-render__action"
            aria-controls={codeId}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "收起代码" : "展开代码"}
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? "收起代码" : "展开代码"}
          </button>
          <button
            type="button"
            className="markdown-render__action"
            aria-label={buttonLabel}
            onClick={copyCode}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
      <pre
        {...props}
        id={codeId}
        className="markdown-render__pre"
        hidden={!isExpanded}
      />
    </div>
  );
}

function MarkdownTable(props: ComponentPropsWithoutRef<"table">) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewportId = useId();
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const updateScrollState = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const maxScrollLeft = Math.max(
      0,
      viewport.scrollWidth - viewport.clientWidth,
    );
    setCanScroll({
      left: viewport.scrollLeft > 1,
      right: viewport.scrollLeft < maxScrollLeft - 1,
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    updateScrollState();
    viewport.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", updateScrollState);

    return () => {
      viewport.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  function scrollTable(direction: -1 | 1) {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollBy({
      left: direction * Math.max(240, viewport.clientWidth * 0.75),
      behavior: "smooth",
    });
  }

  return (
    <div className="markdown-render__table-block">
      <div className="markdown-render__block-toolbar">
        <span className="markdown-render__block-label">TABLE</span>
        <div className="markdown-render__table-actions">
          <button
            type="button"
            className="markdown-render__action markdown-render__action--icon"
            aria-label="向左滚动表格"
            aria-controls={viewportId}
            disabled={!canScroll.left}
            onClick={() => scrollTable(-1)}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            className="markdown-render__action markdown-render__action--icon"
            aria-label="向右滚动表格"
            aria-controls={viewportId}
            disabled={!canScroll.right}
            onClick={() => scrollTable(1)}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        id={viewportId}
        className="markdown-render__table-scroll"
        role="region"
        aria-label="表格滚动区域"
        tabIndex={0}
      >
        <table {...props} className="markdown-render__table" />
      </div>
    </div>
  );
}

const MARKDOWN_COMPONENTS: Components = {
  h1: (props) => (
    <h2
      {...withoutMarkdownNode(props)}
      className="markdown-render__heading markdown-render__heading--1"
    />
  ),
  h2: (props) => (
    <h3
      {...withoutMarkdownNode(props)}
      className="markdown-render__heading markdown-render__heading--2"
    />
  ),
  h3: (props) => (
    <h4
      {...withoutMarkdownNode(props)}
      className="markdown-render__heading markdown-render__heading--3"
    />
  ),
  h4: (props) => (
    <h5
      {...withoutMarkdownNode(props)}
      className="markdown-render__heading markdown-render__heading--4"
    />
  ),
  h5: (props) => (
    <h6
      {...withoutMarkdownNode(props)}
      className="markdown-render__heading markdown-render__heading--5"
    />
  ),
  h6: (props) => (
    <h6
      {...withoutMarkdownNode(props)}
      className="markdown-render__heading markdown-render__heading--6"
    />
  ),
  p: (props) => (
    <p
      {...withoutMarkdownNode(props)}
      className="markdown-render__paragraph"
    />
  ),
  a: ({ children, href, ...props }) => {
    if (!href || !isSafeHttpUrl(href)) return <>{children}</>;

    return (
      <a
        {...withoutMarkdownNode(props)}
        className="markdown-render__link"
        href={href.trim()}
        target="_blank"
        rel="nofollow noopener noreferrer"
      >
        {children}
      </a>
    );
  },
  blockquote: (props) => (
    <blockquote
      {...withoutMarkdownNode(props)}
      className="markdown-render__blockquote"
    />
  ),
  ul: (props) => (
    <ul
      {...withoutMarkdownNode(props)}
      className="markdown-render__list markdown-render__list--unordered"
    />
  ),
  ol: (props) => (
    <ol
      {...withoutMarkdownNode(props)}
      className="markdown-render__list markdown-render__list--ordered"
    />
  ),
  li: (props) => (
    <li
      {...withoutMarkdownNode(props)}
      className="markdown-render__list-item"
    />
  ),
  pre: (props) => <MarkdownCodeBlock {...withoutMarkdownNode(props)} />,
  code: ({ children, className, ...props }) => {
    const isBlock = Boolean(className) || String(children).endsWith("\n");
    const renderedClassName = isBlock
      ? ["markdown-render__code", className].filter(Boolean).join(" ")
      : "markdown-render__inline-code";

    return (
      <code {...withoutMarkdownNode(props)} className={renderedClassName}>
        {children}
      </code>
    );
  },
  table: (props) => <MarkdownTable {...withoutMarkdownNode(props)} />,
  th: (props) => (
    <th
      {...withoutMarkdownNode(props)}
      className="markdown-render__table-heading"
    />
  ),
  td: (props) => (
    <td
      {...withoutMarkdownNode(props)}
      className="markdown-render__table-cell"
    />
  ),
  hr: (props) => (
    <hr {...withoutMarkdownNode(props)} className="markdown-render__rule" />
  ),
  strong: (props) => (
    <strong
      {...withoutMarkdownNode(props)}
      className="markdown-render__strong"
    />
  ),
};

export function MarkdownRender({ content }: MarkdownRenderProps) {
  const [shouldWrap, setShouldWrap] = useState(true);

  return (
    <div className="markdown-render" data-wrap={shouldWrap}>
      <div className="markdown-render__toolbar">
        <button
          type="button"
          className="markdown-render__action markdown-render__wrap-toggle"
          aria-label={shouldWrap ? "关闭自动换行" : "开启自动换行"}
          aria-pressed={shouldWrap}
          onClick={() => setShouldWrap((current) => !current)}
        >
          <span>自动换行</span>
          <strong>{shouldWrap ? "开" : "关"}</strong>
        </button>
      </div>
      <div className="markdown-render__content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          allowedElements={ALLOWED_MARKDOWN_ELEMENTS}
          skipHtml
          components={MARKDOWN_COMPONENTS}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
