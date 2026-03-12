import { useEffect, useState } from "react";

import { useTheme } from "../../hooks/useTheme";

interface CodeBlockProps {
  code: string;
  language: string | null;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const { resolvedTheme } = useTheme();
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { codeToHtml } = await import("shiki");
        const rendered = await codeToHtml(code, {
          lang: language ?? "text",
          theme: resolvedTheme === "dark" ? "github-dark-default" : "github-light-default",
        });
        if (!cancelled) {
          setHtml(rendered);
        }
      } catch {
        if (!cancelled) {
          setHtml(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, language, resolvedTheme]);

  if (!html) {
    return (
      <pre className="overflow-x-auto rounded-xl border border-border bg-muted/40 p-4 text-sm">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="[&_.shiki]:overflow-x-auto [&_.shiki]:rounded-xl [&_.shiki]:border [&_.shiki]:border-border [&_.shiki]:p-4 [&_.shiki]:text-sm [&_.shiki]:!bg-muted/30"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
