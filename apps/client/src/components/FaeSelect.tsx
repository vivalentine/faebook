import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export type FaeSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type FaeSelectProps = {
  id?: string;
  className?: string;
  value: string;
  options: FaeSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

export default function FaeSelect({
  id,
  className,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Select an option",
  ariaLabel,
}: FaeSelectProps) {
  const generatedId = useId();
  const selectId = id ?? `fae-select-${generatedId}`;
  const listboxId = `${selectId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isMenuMounted, setIsMenuMounted] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (!open) return;
    setIsClosing(false);
    setIsMenuMounted(true);
    updateMenuPosition();
    const onWindowChange = () => updateMenuPosition();
    window.addEventListener("resize", onWindowChange);
    window.addEventListener("scroll", onWindowChange, true);
    return () => {
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange, true);
    };
  }, [open]);

  useEffect(() => {
    if (open || !isMenuMounted) return;
    setIsClosing(true);
    const timer = window.setTimeout(() => {
      setIsClosing(false);
      setIsMenuMounted(false);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [isMenuMounted, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  const moveHighlight = (direction: 1 | -1) => {
    if (!options.length) return;
    let nextIndex = highlightedIndex;
    for (let i = 0; i < options.length; i += 1) {
      nextIndex = (nextIndex + direction + options.length) % options.length;
      if (!options[nextIndex].disabled) {
        setHighlightedIndex(nextIndex);
        return;
      }
    }
  };

  const selectIndex = (index: number) => {
    const selected = options[index];
    if (!selected || selected.disabled) return;
    onChange(selected.value);
    setOpen(false);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      moveHighlight(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (highlightedIndex >= 0) {
        selectIndex(highlightedIndex);
      }
    }
  };

  return (
    <>
      <button
        id={selectId}
        ref={triggerRef}
        className={["fae-select-trigger", className].filter(Boolean).join(" ")}
        type="button"
        disabled={disabled}
        aria-disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="fae-select-value">{selectedOption?.label ?? placeholder}</span>
        <span className="fae-select-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {isMenuMounted && menuPosition
        ? createPortal(
            <ul
              ref={menuRef}
              id={listboxId}
              className={`fae-select-menu ${open && !isClosing ? "open" : ""} ${isClosing ? "closing" : ""}`.trim()}
              role="listbox"
              aria-labelledby={selectId}
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
                minWidth: `${menuPosition.width}px`,
              }}
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;
                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    className={[
                      "fae-select-option",
                      isSelected ? "selected" : "",
                      isHighlighted ? "highlighted" : "",
                      option.disabled ? "disabled" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectIndex(index)}
                  >
                    {option.label}
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}
