import { useEffect, useState } from "react";
import { api, getStoredUser } from "../api";
import { fileToDownscaledDataUrl } from "../components/imageFile.js";

const readAsDataUrl = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Could not read the file"));
    r.readAsDataURL(file);
  });

export default function MyReports() {
  const me = getStoredUser();
  const [reports, setReports] = useState(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api.listReports(me.id).then(setReports).catch((e) => setError(e.message));
  }
  useEffect(load, [me.id]);

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isPdf = file.type === "application/pdf";
    const isImg = file.type.startsWith("image/");
    if (!isPdf && !isImg) {
      setError("Only PDF or image files are allowed");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const file_url = isImg
        ? await fileToDownscaledDataUrl(file, 1600, 0.85)
        : await readAsDataUrl(file);
      await api.uploadReport(me.id, { file_url, note: note || null });
      setNote("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h1>My Reports</h1>
      <p style={{ color: "#888", fontSize: "0.85rem" }}>
        Upload a PDF or image (blood work, scans, etc.). Files are kept permanently.
      </p>
      {error && <div className="error">{error}</div>}

      <label>Note (optional)</label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. March blood work" />
      <label>File (PDF or image)</label>
      <input type="file" accept="application/pdf,image/*" onChange={onPick} disabled={busy} />
      {busy && <span style={{ marginLeft: 8 }}>uploading…</span>}

      <h2 style={{ marginTop: 20 }}>Uploaded</h2>
      {reports === null ? (
        <p>Loading…</p>
      ) : reports.length === 0 ? (
        <p>Nothing uploaded yet.</p>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {reports.map((r) => (
            <li key={r.id} style={{ marginBottom: 8 }}>
              <a href={r.file_url} target="_blank" rel="noreferrer">
                {r.note || "report"}
              </a>
              <span style={{ color: "#888", fontSize: "0.75rem", marginLeft: 8 }}>
                {new Date(r.uploaded_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
