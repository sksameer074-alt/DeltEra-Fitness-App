export default function StarRating({ value = 0, onChange, readOnly = false }) {
  return (
    <span className="stars" role={readOnly ? "img" : "radiogroup"} aria-label={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={"star" + (n <= value ? " on" : "")}
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}
