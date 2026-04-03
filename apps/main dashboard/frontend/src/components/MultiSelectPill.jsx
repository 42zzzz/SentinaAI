import { useEffect, useMemo, useRef, useState } from "react";

function defaultGetOptionValue(option) {
  if (option && typeof option === "object") {
    return String(option.value ?? option.id ?? option.key ?? "");
  }
  return String(option ?? "");
}

function defaultGetOptionLabel(option) {
  if (option && typeof option === "object") {
    return String(option.label ?? option.name ?? option.value ?? option.id ?? option.key ?? "");
  }
  return String(option ?? "");
}

export default function MultiSelectPill({
  value = [],
  onChange,
  options = [],
  label,
  icon,
  className = "",
  disabled = false,
  getOptionValue = defaultGetOptionValue,
  getOptionLabel = defaultGetOptionLabel,
}) {
  const wrapperRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const normalizedValue = useMemo(() => value.map(String), [value]);

  const summary = useMemo(() => {
    if (!normalizedValue.length) return label;

    if (normalizedValue.length === 1) {
      const match = options.find((option) => String(getOptionValue(option)) === normalizedValue[0]);
      return match ? getOptionLabel(match) : normalizedValue[0];
    }

    return `${label} (${normalizedValue.length})`;
  }, [getOptionLabel, getOptionValue, label, normalizedValue, options]);

  const toggleValue = (optionValue) => {
    const next = normalizedValue.includes(optionValue)
      ? normalizedValue.filter((item) => item !== optionValue)
      : [...normalizedValue, optionValue];

    onChange?.(next);
  };

  return (
    <div
      ref={wrapperRef}
      className={`filterPill pillSelectWrap ${className} ${open ? "isOpen" : ""} ${disabled ? "isDisabled" : ""}`.trim()}
    >
      {icon ? (
        <span className="pillLeftIcon" aria-hidden>
          {icon}
        </span>
      ) : null}

      <button
        type="button"
        className="pillSelect multiSelectTrigger"
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className="multiSelectSummary">{summary}</span>
      </button>

      <span className="pillRightCaret" aria-hidden />

      {open && !disabled ? (
        <div className="multiSelectMenu" role="listbox" aria-multiselectable="true">
          {options.length ? (
            options.map((option) => {
              const optionValue = String(getOptionValue(option));
              const optionLabel = getOptionLabel(option);
              const checked = normalizedValue.includes(optionValue);

              return (
                <label key={optionValue} className="multiSelectOption">
                  <input
                    className="multiSelectCheckbox"
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleValue(optionValue)}
                  />
                  <span className="multiSelectOptionLabel">{optionLabel}</span>
                </label>
              );
            })
          ) : (
            <div className="multiSelectEmpty">No options</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
