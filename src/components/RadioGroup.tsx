import type { KeyboardEvent } from 'react';

export type Option<T extends string> = { value: T; label: string };

type RadioGroupProps<T extends string> = {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  className?: string;
};

export function RadioGroup<T extends string>({ label, value, options, onChange, className }: RadioGroupProps<T>) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || options.length === 0) return;
    event.preventDefault();
    const current = Math.max(0, options.findIndex((option) => option.value === value));
    const offset = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const next = options[(current + offset + options.length) % options.length];
    onChange(next.value);
    event.currentTarget.querySelector<HTMLElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus();
  };

  return (
    <div className={className} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      <span className="settings-label">{label}</span>
      <div className="target-score-options">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-value={option.value}
            aria-checked={option.value === value}
            tabIndex={option.value === value ? 0 : -1}
            className={`target-score-btn ${option.value === value ? 'target-score-btn--selected' : ''} pressable`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
