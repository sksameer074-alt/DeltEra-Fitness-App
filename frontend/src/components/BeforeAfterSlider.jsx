import { useRef, useState } from "react";

/**
 * Drag-to-reveal before/after comparison. Pointer events cover mouse + touch;
 * the handle is keyboard-operable (arrow keys, Home/End).
 *
 * If either image is missing it falls back to showing whichever one exists
 * (or a placeholder) with no slider.
 */
export default function BeforeAfterSlider({ before, after, label = "" }) {
  const [pos, setPos] = useState(50);
  const boxRef = useRef(null);
  const dragging = useRef(false);

  const both = Boolean(before) && Boolean(after);

  function setFromClientX(clientX) {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = ((clientX - r.left) / r.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }

  function onPointerDown(e) {
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setFromClientX(e.clientX);
  }
  function onPointerMove(e) {
    if (dragging.current) setFromClientX(e.clientX);
  }
  function stop() {
    dragging.current = false;
  }
  function onKeyDown(e) {
    const step = e.shiftKey ? 10 : 4;
    if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - step));
    else if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + step));
    else if (e.key === "Home") setPos(0);
    else if (e.key === "End") setPos(100);
    else return;
    e.preventDefault();
  }

  if (!both) {
    const src = after || before;
    return (
      <div className="ba2 ba2-single">
        {src ? (
          <img src={src} alt={label ? `${label}` : ""} />
        ) : (
          <div className="ba2-empty" aria-hidden="true">
            no photo yet
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="ba2"
      ref={boxRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
    >
      <img className="ba2-img" src={after} alt={label ? `${label} — after` : "after"} draggable="false" />
      <img
        className="ba2-img ba2-before"
        src={before}
        alt={label ? `${label} — before` : "before"}
        draggable="false"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <span className="ba2-tag ba2-tag-before" aria-hidden="true">Before</span>
      <span className="ba2-tag ba2-tag-after" aria-hidden="true">After</span>
      <div
        className="ba2-handle"
        style={{ left: `${pos}%` }}
        role="slider"
        tabIndex={0}
        aria-label={label ? `Reveal ${label} before and after` : "Reveal before and after"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        onKeyDown={onKeyDown}
      >
        <span className="ba2-grip" aria-hidden="true" />
      </div>
    </div>
  );
}
