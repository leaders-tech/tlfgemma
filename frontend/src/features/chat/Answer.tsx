// Render safe streaming Markdown. Edit for answer formatting; copy for another read-only renderer.
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
export function closeBlocks(raw: string) {
  let text = raw;
  const fences = text.match(/^\s*```/gm) || [];
  if (fences.length % 2) text += "\n```";
  // Ignore code and escaped dollars; only close the current math delimiter.
  const outsideCode = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/(`+)[\s\S]*?\1/g, "")
    .replace(/\\./g, "");
  let open = "";
  for (const [delimiter] of outsideCode.matchAll(/\$+/g)) {
    if (delimiter.length > 2) continue;
    if (!open) open = delimiter;
    else if (open === delimiter) open = "";
  }
  if (open === "$$") text += "\n$$";
  if (open === "$") text = text.trimEnd() + "$";
  return text;
}
export function Answer({ text }: { text: string }) {
  return (
    <div className="markdown">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, trust: false, strict: "ignore" }]]}
        skipHtml
        components={{
          img: () => null,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {closeBlocks(text)}
      </Markdown>
    </div>
  );
}
