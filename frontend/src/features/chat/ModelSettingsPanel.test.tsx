// Test editable model settings. Edit for admin behavior; copy for other settings forms.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { it, expect, vi, beforeEach } from "vitest";
import { ModelSettingsPanel } from "./ModelSettingsPanel";
import { postJson } from "../../shared/api";
vi.mock("../../shared/api", () => ({ postJson: vi.fn() }));
const model = "google/gemma-4-26b-a4b-it";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(postJson).mockImplementation(async (_path, body) => ({ model: (body as { model?: string })?.model || model, default_model: model }));
});
it("loads, saves, and restores the default model", async () => {
  render(<ModelSettingsPanel />);
  await waitFor(() => expect(screen.getByLabelText("OpenRouter model")).toHaveValue(model));
  fireEvent.change(screen.getByLabelText("OpenRouter model"), { target: { value: "google/gemma-4-31b-it" } });
  fireEvent.click(screen.getByText("Save model"));
  expect(await screen.findByRole("status")).toHaveTextContent("Model saved.");
  expect(postJson).toHaveBeenCalledWith("/admin/model", { model: "google/gemma-4-31b-it" });
  fireEvent.click(screen.getByText("Use default"));
  await waitFor(() => expect(screen.getByLabelText("OpenRouter model")).toHaveValue(model));
  expect(postJson).toHaveBeenCalledWith("/admin/model", { model });
});
it("keeps edits available after a save failure", async () => {
  render(<ModelSettingsPanel />);
  await waitFor(() => expect(screen.getByLabelText("OpenRouter model")).toHaveValue(model));
  vi.mocked(postJson).mockRejectedValueOnce(new Error("Admin access is required."));
  fireEvent.click(screen.getByText("Save model"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Admin access is required.");
  expect(screen.getByText("Save model")).toBeEnabled();
});
