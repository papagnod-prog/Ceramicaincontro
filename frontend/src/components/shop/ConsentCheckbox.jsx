import { useId } from "react";

/** Checkbox obbligatoria con label associata (WCAG 1.3.1 / 3.3.2). */
export const ConsentCheckbox = ({ checked, onChange, children, testid }) => {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id} type="checkbox" required checked={checked} data-testid={testid}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-4 h-4 accent-[#C05A3E] shrink-0"
      />
      <label htmlFor={id} className="text-xs leading-relaxed text-[#57534E]">{children}</label>
    </div>
  );
};
