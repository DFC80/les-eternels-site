"use client";

import { useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  max?: string;
  min?: string;
}

export default function DateInput({ value, onChange, required, className = "", max, min }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="relative flex items-center">
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        max={max}
        min={min}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => ref.current?.showPicker?.()}
        className="absolute right-2 text-slate-400 hover:text-slate-200"
        title="Ouvrir le calendrier"
      >
        📅
      </button>
    </div>
  );
}
