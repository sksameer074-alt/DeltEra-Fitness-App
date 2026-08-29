import { useEffect, useRef, useState } from "react";
import { useUnsavedGuard } from "../hooks.js";

/**
 * Consistent explicit-save control for every editable form.
 *
 *   <SaveBar dirty={dirty} onSave={handleSave} />
 *
 * - Save button is disabled unless there are unsaved changes.
 * - Shows a brief "Saved" confirmation after a successful save.
 * - Warns before navigating away while there are unsaved changes.
 */
export default function SaveBar({
  dirty,
  onSave,
  label = "Save",
  disabled = false,
  error = "",
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timer = useRef(null);

  useUnsavedGuard(dirty && !saving);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handle() {
    setSaving(true);
    setSaved(false);
    try {
      await onSave();
      setSaved(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="savebar">
      <button
        type="button"
        className="btn btn-primary"
        onClick={handle}
        disabled={disabled || saving || !dirty}
      >
        {saving ? "Saving…" : label}
      </button>
      {saved && !dirty && <span className="toast">Saved</span>}
      {dirty && !saving && <span className="unsaved-note">Unsaved changes</span>}
      {error && <span className="error" style={{ margin: 0 }}>{error}</span>}
    </div>
  );
}
