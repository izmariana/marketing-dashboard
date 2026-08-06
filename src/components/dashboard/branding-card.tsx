"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Panel } from "@/components/dashboard/panel";
import { useBranding, DEFAULT_BRANDING } from "@/hooks/use-branding";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_IMAGE_SIZE_BYTES = 650_000; // ~650KB, coherente con el límite del servidor

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ImageUploadField({
  label,
  value,
  onChange,
  shape = "square",
}: {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  shape?: "square" | "round";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Debe ser un archivo de imagen (PNG, JPG, SVG...).");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError("La imagen es muy pesada. Usa una menor a 650KB.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    onChange(dataUrl);
  }

  return (
    <div>
      <label className="block text-xs font-medium text-muted mb-1.5">{label}</label>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "h-14 w-14 shrink-0 border border-border bg-surface-2 flex items-center justify-center overflow-hidden relative",
            shape === "round" ? "rounded-full" : "rounded-lg"
          )}
        >
          {value ? (
            <Image src={value} alt="" fill unoptimized className="object-cover" />
          ) : (
            <Upload className="h-4 w-4 text-muted" />
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-xs font-medium rounded-md border border-border px-2.5 py-1.5 hover:bg-surface-2 transition-colors"
            >
              {value ? "Cambiar" : "Subir imagen"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-xs text-muted hover:text-danger flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Quitar
              </button>
            )}
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

export function BrandingCard() {
  const { data: branding } = useBranding();
  const queryClient = useQueryClient();

  const [platformName, setPlatformName] = useState(DEFAULT_BRANDING.platformName);
  const [companyName, setCompanyName] = useState(DEFAULT_BRANDING.companyName);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [faviconDataUrl, setFaviconDataUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_BRANDING.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_BRANDING.secondaryColor);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Precarga el formulario con lo que ya está guardado, una sola vez
  useEffect(() => {
    if (branding && !initialized) {
      setPlatformName(branding.platformName);
      setCompanyName(branding.companyName);
      setLogoDataUrl(branding.logoDataUrl);
      setFaviconDataUrl(branding.faviconDataUrl);
      setPrimaryColor(branding.primaryColor);
      setSecondaryColor(branding.secondaryColor);
      setInitialized(true);
    }
  }, [branding, initialized]);

  async function handleSave() {
    setServerError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformName, companyName, logoDataUrl, faviconDataUrl, primaryColor, secondaryColor }),
      });

      let data: { error?: string; details?: unknown } = {};
      try {
        data = await res.json();
      } catch {
        setServerError(`El servidor respondió con un error inesperado (código ${res.status}). Intenta de nuevo en un momento.`);
        return;
      }

      if (!res.ok) {
        setServerError(data.error ?? `No se pudo guardar (código ${res.status}).`);
        return;
      }
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["branding"] });
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setServerError(err instanceof Error ? `No se pudo conectar con el servidor: ${err.message}` : "No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Branding" description="Personaliza el nombre, logo, favicon y colores de la plataforma — sin tocar código">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Nombre de la plataforma</label>
          <input
            value={platformName}
            onChange={(e) => setPlatformName(e.target.value)}
            placeholder="Marketing Segal"
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Nombre de la empresa</label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Segal"
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <ImageUploadField label="Logo" value={logoDataUrl} onChange={setLogoDataUrl} />
        <ImageUploadField label="Favicon" value={faviconDataUrl} onChange={setFaviconDataUrl} shape="round" />

        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Color principal</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-9 rounded-md border border-border cursor-pointer bg-transparent"
            />
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm font-mono outline-none focus:border-accent"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Color secundario</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-9 w-9 rounded-md border border-border cursor-pointer bg-transparent"
            />
            <input
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm font-mono outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      {serverError && <p className="text-xs text-danger mt-3">{serverError}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className={cn(
          "mt-4 rounded-md text-sm font-medium py-2 px-4 transition-colors",
          saved ? "bg-success text-white" : "bg-accent text-accent-foreground hover:opacity-90"
        )}
      >
        {saved ? (
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Guardado
          </span>
        ) : saving ? (
          "Guardando..."
        ) : (
          "Guardar branding"
        )}
      </button>
    </Panel>
  );
}
