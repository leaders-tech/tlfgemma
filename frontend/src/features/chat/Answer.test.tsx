// Test safe Markdown and raw copying. Edit for rendering changes; copy for other text renderers.
import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { Answer, closeBlocks } from "./Answer";
import { HistoryList } from "./History";
it("renders math and repairs a fenced block", () => {
  const { container } = render(<Answer text={"$$x^2$$\n\n```python\nprint(1)"} />);
  expect(container.querySelector(".katex")).not.toBeNull();
  expect(container.querySelector("pre code")).toHaveTextContent("print(1)");
  expect(closeBlocks("$$x")).toBe("$$x\n$$");
});
it("blocks raw HTML and external images", () => {
  const { container } = render(<Answer text={"<script>alert(1)</script>\n![tracking](https://evil.invalid/image)\n[bad](javascript:alert(1))"} />);
  expect(container.querySelector("script,img")).toBeNull();
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
});
it("renders a truncated inline integral even with trailing whitespace", () => {
  const raw = String.raw`Тогда $I^2 = \int_{-\infty}^{+\infty} e^{-x^2} dx \cdot \int_{-\infty}^{+\infty} e^{-y^2} `;
  expect(closeBlocks(raw)).toBe(raw.trimEnd() + "$");
  const { container } = render(<Answer text={raw} />);
  expect(container.querySelector(".katex")).not.toBeNull();
  expect(container.querySelector(".katex-error")).toBeNull();
});
it("ignores escaped dollars and code while keeping completed math unchanged", () => {
  for (const raw of [String.raw`Price: \$5`, "`$x`", "```sh\n$HOME\n```", "$x$ and $$y$$", "$$x + $y"]) {
    expect(closeBlocks(raw)).toBe(raw === "$$x + $y" ? raw + "\n$$" : raw);
  }
  expect(closeBlocks("`$code` and $x")).toBe("`$code` and $x$");
});
it.each(["```python\nx", "$x^2 "])("copies the exact original answer %s", async (answer) => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  render(
    <HistoryList
      messages={[
        {
          id: 1,
          user_id: 1,
          request_id: "a",
          prompt: "hello",
          answer,
          status: "complete",
          error: null,
          truncated: 1,
          version: 2,
          created_at: new Date().toISOString(),
        },
      ]}
    />,
  );
  fireEvent.click(screen.getByText("Copy raw"));
  expect(writeText).toHaveBeenCalledWith(answer);
  expect(await screen.findByText("Copied")).toBeVisible();
});
