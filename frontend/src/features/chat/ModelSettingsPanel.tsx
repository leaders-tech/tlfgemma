// Let admins set the shared model. Edit for model settings; copy for another small settings form.
import { useEffect, useState } from "react";
import { postJson } from "../../shared/api";
import type { ModelSettings } from "../../shared/types";
export function ModelSettingsPanel() {
  const [settings, setSettings] = useState<ModelSettings | null>(null);
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let stopped = false;
    void postJson<ModelSettings>("/chat/model")
      .then((data) => {
        if (!stopped) {
          setSettings(data);
          setModel(data.model);
        }
      })
      .catch((e) => {
        if (!stopped) setError(e.message);
      });
    return () => {
      stopped = true;
    };
  }, []);
  async function save(value: string) {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const data = await postJson<ModelSettings>("/admin/model", { model: value });
      setSettings(data);
      setModel(data.model);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="model-settings" aria-label="Model settings">
      <h2>Model settings</h2>
      <p>Applies to new messages for everyone. Active answers keep their model. Reasoning is always off.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(model);
        }}
      >
        <label htmlFor="openrouter-model">OpenRouter model</label>
        <input
          id="openrouter-model"
          value={model}
          maxLength={200}
          disabled={!settings || saving}
          onChange={(e) => {
            setModel(e.target.value);
            setSaved(false);
          }}
          placeholder="provider/model"
          required
        />
        <div className="model-actions">
          <button className="primary" disabled={!settings || saving || !model.trim()}>
            {saving ? "Saving…" : "Save model"}
          </button>
          <button
            type="button"
            disabled={!settings || saving}
            onClick={() => {
              if (settings) void save(settings.default_model);
            }}
          >
            Use default
          </button>
          {saved && <span role="status">Model saved.</span>}
        </div>
      </form>
      {settings && <p className="model-default">Default: {settings.default_model}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
