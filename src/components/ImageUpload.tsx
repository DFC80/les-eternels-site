"use client";

import { useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  className?: string;
}

export default function ImageUpload({ value, onChange, label, className = "" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'upload.");
      } else {
        onChange(data.url);
      }
    } catch {
      setError("Erreur réseau lors de l'upload.");
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-slate-300">{label}</label>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleChange}
      />

      {value ? (
        <div className="mt-1 flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Aperçu"
            className="h-24 w-24 rounded-lg border border-primary-700 object-cover"
          />
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-md border border-primary-600 bg-primary-950 px-3 py-1.5 text-sm text-slate-300 hover:border-primary-400 hover:text-slate-100 disabled:opacity-50"
            >
              {uploading ? "Upload…" : "Changer"}
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-sm text-red-400 hover:underline"
            >
              Supprimer
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary-700 bg-primary-950/40 px-4 py-6 text-center transition hover:border-primary-500"
        >
          {uploading ? (
            <p className="text-sm text-slate-400">Upload en cours…</p>
          ) : (
            <>
              <p className="text-2xl">🖼️</p>
              <p className="text-sm text-slate-400">
                Cliquez ou déposez une image ici
              </p>
              <p className="text-xs text-slate-600">JPG, PNG, WEBP, GIF · max 10 Mo</p>
            </>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
