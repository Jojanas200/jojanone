"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders Jova's answers as clean formatted text (headings, bold, bullets)
// instead of raw Markdown characters. Styling is kept compact so answers sit
// naturally inside the chat bubble.
export function JovaMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <p className="text-sm font-semibold text-foreground">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="text-sm font-semibold text-foreground">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="text-sm font-semibold text-foreground">{children}</p>
          ),
          h4: ({ children }) => (
            <p className="text-sm font-semibold text-foreground">{children}</p>
          ),
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="text-xs">{children}</table>
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
