import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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
  const menuRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState("bottom");
  const [menuMaxHeight, setMenuMaxHeight] = useState(280);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

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

  useLayoutEffect(() => {
    if (!open) return;

    const updateMenuPlacement = () => {
      const wrapperEl = wrapperRef.current;
      const menuEl = menuRef.current;
      if (!wrapperEl || !menuEl) return;

      const gutter = 12;
      const wrapperRect = wrapperEl.getBoundingClientRect();
      const naturalHeight = Math.min(menuEl.scrollHeight || 280, 320);

      const spaceBelow = Math.max(0, window.innerHeight - wrapperRect.bottom - gutter);
      const spaceAbove = Math.max(0, wrapperRect.top - gutter);

      const shouldOpenUpward =
        spaceBelow < Math.min(naturalHeight, 180) && spaceAbove > spaceBelow;

      const usableSpace = Math.max(shouldOpenUpward ? spaceAbove : spaceBelow, 120);

      setMenuPlacement(shouldOpenUpward ? "top" : "bottom");
      setMenuMaxHeight(Math.min(naturalHeight, usableSpace));
    };

    updateMenuPlacement();

    window.addEventListener("resize", updateMenuPlacement);
    window.addEventListener("scroll", updateMenuPlacement, true);

    return () => {
      window.removeEventListener("resize", updateMenuPlacement);
      window.removeEventListener("scroll", updateMenuPlacement, true);
    };
  }, [open, options.length]);

  const normalizedValue = useMemo(
    () => (Array.isArray(value) ? value.map(String) : []),
    [value]
  );

  const summary = useMemo(() => {
    if (!normalizedValue.length) return label;

    if (normalizedValue.length === 1) {
      const match = options.find(
        (option) => String(getOptionValue(option)) === normalizedValue[0]
      );
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
        <div
          ref={menuRef}
          className={`multiSelectMenu ${menuPlacement === "top" ? "isTop" : "isBottom"}`}
          role="listbox"
          aria-multiselectable="true"
          style={{ maxHeight: menuMaxHeight }}
        >
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