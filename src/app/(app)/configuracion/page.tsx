"use client";

import { useEffect, useState, Suspense } from "react"; import { useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Topbar } from "@/components/layout/topbar";
import { Panel } from "@/components/dashboard/panel";
import { BrandingCard } from "@/components/dashboard/branding-card";
import { BRANDS } from "@/types/domain";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const brandCredentialSchema = z.object({
  // Vacío = "no cambiar el token guardado". Si se escribe algo, debe ser un token válido.
  metaAccessToken: z.string().refine((v) => v === "" || v.length >= 20, "El token de acceso parece inválido"),
  adAccountId: z.string().regex(/^act_\d+$/, "Debe tener el formato act_XXXXXXXXXX"),
  facebookPageId: z.string().min(1, "Requerido"),
  instagramBusinessId: z.string().min(1, "Requerido"),
});

const settingsSchema = z.object({
  openaiApiKey: z.string().min(20, "La API Key de OpenAI parece inválida"),
});

const gaCredentialSchema = z.object({
  propertyId: z.string().min(1, "Ingresa el Property ID de GA4"),
  serviceAccountJson: z.string().min(50, "Pega el JSON completo de la Service Account"),
});

const tiktokCredentialSchema = z.object({
  accessToken: z.string().refine((v) => v === "" || v.length >= 20, "El token de acceso parece inválido"),
  openId: z.string().min(1, "Requerido"),
});

const linkedinCredentialSchema = z.object({
  accessToken: z.string().refine((v) => v === "" || v.length >= 20, "El token de acceso parece inválido"),
  organizationUrn: z.string().regex(/^urn:li:organization:\d+$/, "Debe tener el formato urn:li:organization:XXXXXXXX"),
});

type BrandCredentialForm = z.infer<typeof brandCredentialSchema>;
type SettingsForm = z.infer<typeof settingsSchema>;
type GaCredentialForm = z.infer<typeof gaCredentialSchema>;
type TikTokCredentialForm = z.infer<typeof tiktokCredentialSchema>;
type LinkedinCredentialForm = z.infer<typeof linkedinCredentialSchema>;

function BrandCredentialCard({ brandSlug, brandName, brandColor }: { brandSlug: string; brandName: string; brandColor: string }) {
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string;
    accountName?: string;
    accountStatus?: number;
    currency?: string;
    totalCampaigns?: number;
    page?: { ok: boolean; name?: string; error?: string };
    instagram?: { ok: boolean; username?: string; error?: string };
  } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BrandCredentialForm>({
    resolver: zodResolver(brandCredentialSchema),
    defaultValues: { metaAccessToken: "", adAccountId: "", facebookPageId: "", instagramBusinessId: "" },
  });

  // Precarga lo que ya está guardado (menos el token, que nunca se expone)
  // — antes el formulario siempre aparecía vacío al recargar, aunque los
  // datos sí estuvieran guardados en la base de datos.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/meta-credentials")
      .then((res) => res.json())
      .then(
        (data: {
          statuses?: Array<{
            brandSlug: string;
            hasAccessToken: boolean;
            adAccountId: string | null;
            facebookPageId: string | null;
            instagramBusinessId: string | null;
          }>;
        }) => {
          if (cancelled) return;
          const mine = data.statuses?.find((s) => s.brandSlug === brandSlug);
          if (mine) {
            setHasAccessToken(mine.hasAccessToken);
            reset({
              metaAccessToken: "",
              adAccountId: mine.adAccountId ?? "",
              facebookPageId: mine.facebookPageId ?? "",
              instagramBusinessId: mine.instagramBusinessId ?? "",
            });
          }
        }
      )
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [brandSlug, reset]);

  async function onSubmit(values: BrandCredentialForm) {
    setServerError(null);
    if (!hasAccessToken && !values.metaAccessToken) {
      setServerError("Falta el Meta Access Token — es obligatorio la primera vez que conectas esta marca.");
      return;
    }
    try {
      const res = await fetch("/api/settings/meta-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandSlug,
          ...values,
          // Si el usuario no escribió un token nuevo, no lo mandamos — el
          // backend conserva el que ya tenía guardado.
          metaAccessToken: values.metaAccessToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "No se pudo guardar. Intenta de nuevo.");
        return;
      }
      setHasAccessToken(true);
      reset({ ...values, metaAccessToken: "" });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setServerError("No se pudo conectar con el servidor. Intenta de nuevo.");
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/settings/meta-credentials/test?brand=${brandSlug}`);
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: "No se pudo conectar con el servidor." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Panel>
      <div className="flex items-center gap-2 mb-4">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: brandColor }} />
        <h3 className="text-sm font-medium">{brandName}</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Meta Access Token</label>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              {...register("metaAccessToken")}
              placeholder={loaded && hasAccessToken ? "•••••••• (ya guardado — deja vacío para no cambiarlo)" : "EAAxxxxxxxxxxxxxxxxxxxxxxxx"}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 pr-9 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setShowToken((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted"
            >
              {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          {errors.metaAccessToken && <p className="text-xs text-danger mt-1">{errors.metaAccessToken.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Ad Account ID</label>
          <input
            {...register("adAccountId")}
            placeholder="act_1234567890"
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {errors.adAccountId && <p className="text-xs text-danger mt-1">{errors.adAccountId.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Facebook Page ID</label>
            <input
              {...register("facebookPageId")}
              placeholder="1234567890"
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {errors.facebookPageId && <p className="text-xs text-danger mt-1">{errors.facebookPageId.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Instagram Business ID</label>
            <input
              {...register("instagramBusinessId")}
              placeholder="1789..."
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {errors.instagramBusinessId && <p className="text-xs text-danger mt-1">{errors.instagramBusinessId.message}</p>}
          </div>
        </div>

        {serverError && <p className="text-xs text-danger">{serverError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full rounded-md text-sm font-medium py-2 transition-colors",
            saved ? "bg-success text-white" : "bg-accent text-accent-foreground hover:opacity-90"
          )}
        >
          {saved ? (
            <span className="flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Guardado
            </span>
          ) : isSubmitting ? (
            "Guardando..."
          ) : (
            "Guardar credenciales"
          )}
        </button>

        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing}
          className="w-full rounded-md text-sm font-medium py-2 border border-border hover:bg-surface-2 transition-colors disabled:opacity-50"
        >
          {testing ? "Probando conexión..." : "Probar conexión guardada"}
        </button>

        {testResult && (
          <div className={cn("rounded-md border p-3 text-xs space-y-2", testResult.ok ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5")}>
            {testResult.ok ? (
              <div className="space-y-1 text-foreground/90">
                <p className="font-medium text-success">✓ Meta Ads: conexión exitosa</p>
                <p>Cuenta: <strong>{testResult.accountName}</strong> ({testResult.currency})</p>
                <p>Estado de la cuenta: {testResult.accountStatus === 1 ? "Activa" : `código ${testResult.accountStatus}`}</p>
                <p>Campañas encontradas en el catálogo: <strong>{testResult.totalCampaigns}</strong></p>
                {testResult.totalCampaigns === 0 && (
                  <p className="text-warning mt-1">
                    ⚠️ La conexión funciona, pero esta cuenta publicitaria no tiene ninguna campaña. Verifica que el Ad Account ID guardado sea el correcto para {brandName}.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-danger">✗ Meta Ads: {testResult.error}</p>
            )}

            {testResult.page && (
              <p className={testResult.page.ok ? "text-success" : "text-danger"}>
                {testResult.page.ok ? `✓ Página de Facebook: ${testResult.page.name}` : `✗ Página de Facebook: ${testResult.page.error}`}
              </p>
            )}
            {testResult.instagram && (
              <p className={testResult.instagram.ok ? "text-success" : "text-danger"}>
                {testResult.instagram.ok ? `✓ Instagram: @${testResult.instagram.username}` : `✗ Instagram: ${testResult.instagram.error}`}
              </p>
            )}
          </div>
        )}
      </form>
    </Panel>
  );
}

function GaCredentialCard({ brandSlug, brandName, brandColor }: { brandSlug: string; brandName: string; brandColor: string }) {
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string;
    accountName?: string;
    accountStatus?: number;
    currency?: string;
    lastSyncedAt?: string | null;
    syncStatus?: string | null;
    syncError?: string | null;
  } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GaCredentialForm>({ resolver: zodResolver(gaCredentialSchema) });

  async function onSubmit(values: GaCredentialForm) {
    setServerError(null);
    try {
      const res = await fetch("/api/settings/ga-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandSlug, ...values }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "No se pudo guardar. Intenta de nuevo.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setServerError("No se pudo conectar con el servidor. Intenta de nuevo.");
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/settings/ga-credentials/test?brand=${brandSlug}`);
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: "No se pudo conectar con el servidor." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Panel>
      <div className="flex items-center gap-2 mb-4">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: brandColor }} />
        <h3 className="text-sm font-medium">{brandName}</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Property ID de GA4</label>
          <input
            {...register("propertyId")}
            placeholder="123456789"
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {errors.propertyId && <p className="text-xs text-danger mt-1">{errors.propertyId.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1">JSON de la Service Account</label>
          <textarea
            {...register("serviceAccountJson")}
            placeholder='{"type": "service_account", "client_email": "...", "private_key": "..."}'
            rows={4}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-mono outline-none focus:border-accent resize-none"
          />
          {errors.serviceAccountJson && <p className="text-xs text-danger mt-1">{errors.serviceAccountJson.message}</p>}
        </div>

        {serverError && <p className="text-xs text-danger">{serverError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full rounded-md text-sm font-medium py-2 transition-colors",
            saved ? "bg-success text-white" : "bg-accent text-accent-foreground hover:opacity-90"
          )}
        >
          {saved ? (
            <span className="flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Conectado
            </span>
          ) : isSubmitting ? (
            "Probando conexión..."
          ) : (
            "Guardar y probar conexión"
          )}
        </button>

        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing}
          className="w-full rounded-md text-sm font-medium py-2 border border-border hover:bg-surface-2 transition-colors disabled:opacity-50"
        >
          {testing ? "Probando conexión..." : "Probar conexión guardada"}
        </button>

        {testResult && (
          <div className={cn("rounded-md border p-3 text-xs", testResult.ok ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5")}>
            {testResult.ok ? (
              <div className="space-y-1 text-foreground/90">
                <p className="font-medium text-success">✓ Conexión exitosa</p>
                <p>Última sincronización: {testResult.lastSyncedAt ? new Date(testResult.lastSyncedAt).toLocaleString("es-CL") : "nunca"}</p>
                <p>Estado de sincronización: {testResult.syncStatus ?? "idle"}</p>
                {testResult.syncError && <p className="text-danger">Último error de sync: {testResult.syncError}</p>}
              </div>
            ) : (
              <p className="text-danger">✗ {testResult.error}</p>
            )}
          </div>
        )}
      </form>
    </Panel>
  );
}

function TikTokCredentialCard({ brandSlug, brandName, brandColor }: { brandSlug: string; brandName: string; brandColor: string }) {
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string;
    displayName?: string;
    followerCount?: number;
    videoCount?: number;
  } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TikTokCredentialForm>({
    resolver: zodResolver(tiktokCredentialSchema),
    defaultValues: { accessToken: "", openId: "" },
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/tiktok-credentials")
      .then((res) => res.json())
      .then((data: { statuses?: Array<{ brandSlug: string; hasAccessToken: boolean; openId: string | null }> }) => {
        if (cancelled) return;
        const mine = data.statuses?.find((s) => s.brandSlug === brandSlug);
        if (mine) {
          setHasAccessToken(mine.hasAccessToken);
          reset({ accessToken: "", openId: mine.openId ?? "" });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [brandSlug, reset]);

  async function onSubmit(values: TikTokCredentialForm) {
    setServerError(null);
    if (!hasAccessToken && !values.accessToken) {
      setServerError("Falta el Access Token de TikTok — es obligatorio la primera vez que conectas esta marca.");
      return;
    }
    try {
      const res = await fetch("/api/settings/tiktok-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandSlug, ...values, accessToken: values.accessToken || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "No se pudo guardar. Intenta de nuevo.");
        return;
      }
      setHasAccessToken(true);
      reset({ ...values, accessToken: "" });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setServerError("No se pudo conectar con el servidor. Intenta de nuevo.");
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/settings/tiktok-credentials/test?brand=${brandSlug}`);
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: "No se pudo conectar con el servidor." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Panel>
      <div className="flex items-center gap-2 mb-4">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: brandColor }} />
        <h3 className="text-sm font-medium">{brandName}</h3>
      </div> <a href={`/api/auth/tiktok/authorize?brandSlug=${brandSlug}`}
        className="mb-3 flex items-center justify-center gap-1.5 text-xs font-medium rounded-md bg-black text-white px-3 py-2 hover:opacity-90 transition-opacity"
      >
        Conectar con TikTok (login automático)
      </a>
      <p className="text-[11px] text-muted mb-4">
        Abre el login real de TikTok — al autorizar, el token queda guardado solo. Requiere que ya hayas creado la app en developers.tiktok.com y configurado TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET en Vercel.
      </p>
      <p className="text-[11px] text-muted mb-2">O pega un token manualmente si ya lo tienes:</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">TikTok Access Token</label>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              {...register("accessToken")}
              placeholder={loaded && hasAccessToken ? "•••••••• (ya guardado — deja vacío para no cambiarlo)" : "act.xxxxxxxxxxxxxxxxxxxxxxxx"}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 pr-9 text-sm outline-none focus:border-accent"
            />
            <button type="button" onClick={() => setShowToken((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted">
              {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          {errors.accessToken && <p className="text-xs text-danger mt-1">{errors.accessToken.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Open ID de la cuenta de negocio</label>
          <input
            {...register("openId")}
            placeholder="-000xxxxxxxxxxxxxxxx"
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {errors.openId && <p className="text-xs text-danger mt-1">{errors.openId.message}</p>}
        </div>

        {serverError && <p className="text-xs text-danger">{serverError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full rounded-md text-sm font-medium py-2 transition-colors",
            saved ? "bg-success text-white" : "bg-accent text-accent-foreground hover:opacity-90"
          )}
        >
          {saved ? (
            <span className="flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Guardado
            </span>
          ) : isSubmitting ? (
            "Guardando..."
          ) : (
            "Guardar credenciales"
          )}
        </button>

        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing}
          className="w-full rounded-md text-sm font-medium py-2 border border-border hover:bg-surface-2 transition-colors disabled:opacity-50"
        >
          {testing ? "Probando conexión..." : "Probar conexión guardada"}
        </button>

        {testResult && (
          <div className={cn("rounded-md border p-3 text-xs", testResult.ok ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5")}>
            {testResult.ok ? (
              <div className="space-y-1 text-foreground/90">
                <p className="font-medium text-success">✓ Conexión exitosa</p>
                <p>Cuenta: <strong>{testResult.displayName}</strong></p>
                <p>Seguidores: <strong>{testResult.followerCount}</strong></p>
              </div>
            ) : (
              <p className="text-danger">✗ {testResult.error}</p>
            )}
          </div>
        )}
      </form>
    </Panel>
  );
}

function LinkedinCredentialCard({ brandSlug, brandName, brandColor }: { brandSlug: string; brandName: string; brandColor: string }) {
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; followerCount?: number } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LinkedinCredentialForm>({
    resolver: zodResolver(linkedinCredentialSchema),
    defaultValues: { accessToken: "", organizationUrn: "" },
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/linkedin-credentials")
      .then((res) => res.json())
      .then((data: { statuses?: Array<{ brandSlug: string; hasAccessToken: boolean; organizationUrn: string | null }> }) => {
        if (cancelled) return;
        const mine = data.statuses?.find((s) => s.brandSlug === brandSlug);
        if (mine) {
          setHasAccessToken(mine.hasAccessToken);
          reset({ accessToken: "", organizationUrn: mine.organizationUrn ?? "" });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [brandSlug, reset]);

  async function onSubmit(values: LinkedinCredentialForm) {
    setServerError(null);
    if (!hasAccessToken && !values.accessToken) {
      setServerError("Falta el Access Token de LinkedIn — es obligatorio la primera vez que conectas esta marca.");
      return;
    }
    try {
      const res = await fetch("/api/settings/linkedin-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandSlug, ...values, accessToken: values.accessToken || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "No se pudo guardar. Intenta de nuevo.");
        return;
      }
      setHasAccessToken(true);
      reset({ ...values, accessToken: "" });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setServerError("No se pudo conectar con el servidor. Intenta de nuevo.");
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/settings/linkedin-credentials/test?brand=${brandSlug}`);
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: "No se pudo conectar con el servidor." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Panel>
      <div className="flex items-center gap-2 mb-4">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: brandColor }} />
        <h3 className="text-sm font-medium">{brandName}</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">LinkedIn Access Token</label>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              {...register("accessToken")}
              placeholder={loaded && hasAccessToken ? "•••••••• (ya guardado — deja vacío para no cambiarlo)" : "AQXxxxxxxxxxxxxxxxxxxxxxxxx"}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 pr-9 text-sm outline-none focus:border-accent"
            />
            <button type="button" onClick={() => setShowToken((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted">
              {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          {errors.accessToken && <p className="text-xs text-danger mt-1">{errors.accessToken.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Organization URN</label>
          <input
            {...register("organizationUrn")}
            placeholder="urn:li:organization:12345678"
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {errors.organizationUrn && <p className="text-xs text-danger mt-1">{errors.organizationUrn.message}</p>}
        </div>

        {serverError && <p className="text-xs text-danger">{serverError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full rounded-md text-sm font-medium py-2 transition-colors",
            saved ? "bg-success text-white" : "bg-accent text-accent-foreground hover:opacity-90"
          )}
        >
          {saved ? (
            <span className="flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Guardado
            </span>
          ) : isSubmitting ? (
            "Guardando..."
          ) : (
            "Guardar credenciales"
          )}
        </button>

        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing}
          className="w-full rounded-md text-sm font-medium py-2 border border-border hover:bg-surface-2 transition-colors disabled:opacity-50"
        >
          {testing ? "Probando conexión..." : "Probar conexión guardada"}
        </button>

        {testResult && (
          <div className={cn("rounded-md border p-3 text-xs", testResult.ok ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5")}>
            {testResult.ok ? (
              <div className="space-y-1 text-foreground/90">
                <p className="font-medium text-success">✓ Conexión exitosa</p>
                <p>Seguidores: <strong>{testResult.followerCount}</strong></p>
              </div>
            ) : (
              <p className="text-danger">✗ {testResult.error}</p>
            )}
          </div>
        )}
      </form>
    </Panel>
  );
}

function OpenAiSettingsCard() {
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettingsForm>({ resolver: zodResolver(settingsSchema) });

  async function onSubmit(values: SettingsForm) {
    setServerError(null);
    try {
      const res = await fetch("/api/settings/openai-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "No se pudo guardar. Intenta de nuevo.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setServerError("No se pudo conectar con el servidor. Intenta de nuevo.");
    }
  }

  return (
    <Panel title="Inteligencia Artificial" description="Necesaria para Marketing Advisor IA, insights de contenidos y reportes ejecutivos">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 max-w-md">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">OpenAI API Key</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              {...register("openaiApiKey")}
              placeholder="sk-proj-xxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 pr-9 text-sm outline-none focus:border-accent"
            />
            <button type="button" onClick={() => setShowKey((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted">
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          {errors.openaiApiKey && <p className="text-xs text-danger mt-1">{errors.openaiApiKey.message}</p>}
        </div>
        {serverError && <p className="text-xs text-danger">{serverError}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "rounded-md text-sm font-medium py-2 px-4 transition-colors",
            saved ? "bg-success text-white" : "bg-accent text-accent-foreground hover:opacity-90"
          )}
        >
          {saved ? "Guardado" : isSubmitting ? "Guardando..." : "Guardar API Key"}
        </button>
      </form>
    </Panel>
  );
}

function TikTokOAuthBanner() {
  const searchParams = useSearchParams();
  const tiktokSuccess = searchParams.get("tiktok_success");
  const tiktokError = searchParams.get("tiktok_error");
  if (!tiktokSuccess && !tiktokError) return null;
  return (
    <>
      {tiktokSuccess && (
        <div className="rounded-md border border-success/30 bg-success/5 p-3 text-sm text-success">
          ✓ TikTok conectado correctamente para {tiktokSuccess}.
        </div>
      )}
      {tiktokError && (
        <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          ✗ {tiktokError}
        </div>
      )}
    </>
  );
} export default function ConfiguracionPage() {
  return (
    <div>
      <Topbar title="Configuración" />
      <div className="p-6 space-y-6 max-w-5xl">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Configuración</h2>
          <p className="text-sm text-muted">
            Conecta tus cuentas de Meta Ads y tu API Key de OpenAI. Los tokens se almacenan encriptados (AES-256-GCM) en la base de datos, nunca en texto plano.
          </p>
        </div>

        <BrandingCard />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BRANDS.map((b) => (
            <BrandCredentialCard key={b.slug} brandSlug={b.slug} brandName={b.name} brandColor={b.themeColor} />
          ))}
        </div>

        <OpenAiSettingsCard />

        <div>
          <h3 className="text-base font-semibold tracking-tight mb-1">TikTok</h3>
          <p className="text-sm text-muted mb-4">
            Conecta la cuenta de TikTok Business de cada marca. Requiere una app aprobada en developers.tiktok.com con los scopes <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">user.info.stats</code> y <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">video.list</code>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BRANDS.map((b) => (
              <TikTokCredentialCard key={b.slug} brandSlug={b.slug} brandName={b.name} brandColor={b.themeColor} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold tracking-tight mb-1">LinkedIn</h3>
          <p className="text-sm text-muted mb-4">
            Conecta la Página de empresa de LinkedIn de cada marca. Requiere que la app tenga aprobado el acceso al &ldquo;Community Management API&rdquo; en LinkedIn Developers — es una aprobación caso a caso, no autoservicio.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BRANDS.map((b) => (
              <LinkedinCredentialCard key={b.slug} brandSlug={b.slug} brandName={b.name} brandColor={b.themeColor} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold tracking-tight mb-1">Google Analytics 4</h3>
          <p className="text-sm text-muted mb-4">
            Conecta el Property de GA4 de cada marca usando una Service Account con acceso de lectura.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BRANDS.map((b) => (
              <GaCredentialCard key={b.slug} brandSlug={b.slug} brandName={b.name} brandColor={b.themeColor} />
            ))}
          </div>
        </div>

        <Panel title="Cómo obtener tus credenciales de Google Analytics">
          <ol className="text-sm text-foreground/90 space-y-2 list-decimal list-inside">
            <li>Ve a <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">console.cloud.google.com</code> → crea o selecciona un proyecto.</li>
            <li>Ve a &ldquo;APIs y servicios&rdquo; → &ldquo;Biblioteca&rdquo; → busca y habilita &ldquo;Google Analytics Data API&rdquo;.</li>
            <li>Ve a &ldquo;IAM y administración&rdquo; → &ldquo;Cuentas de servicio&rdquo; → &ldquo;Crear cuenta de servicio&rdquo;.</li>
            <li>Una vez creada, entra a ella → pestaña &ldquo;Claves&rdquo; → &ldquo;Agregar clave&rdquo; → &ldquo;Crear clave nueva&rdquo; → formato JSON. Se descarga un archivo — ábrelo y copia todo su contenido.</li>
            <li>Ve a <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">analytics.google.com</code> → Administrador → selecciona tu Property → &ldquo;Gestión de acceso a la propiedad&rdquo; → agrega el correo de la cuenta de servicio (termina en <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">@...iam.gserviceaccount.com</code>) con rol &ldquo;Viewer&rdquo;.</li>
            <li>El Property ID lo encuentras en Administrador → &ldquo;Detalles de la propiedad&rdquo; (es un número, no el Measurement ID que empieza con G-).</li>
          </ol>
        </Panel>

        <Panel title="Cómo obtener tus credenciales de Meta">
          <ol className="text-sm text-foreground/90 space-y-2 list-decimal list-inside">
            <li>Crea una app en developers.facebook.com → My Apps → Create App → tipo &ldquo;Business&rdquo;.</li>
            <li>Agrega el producto &ldquo;Marketing API&rdquo; y &ldquo;Facebook Login for Business&rdquo;.</li>
            <li>En Herramientas → Graph API Explorer, genera un User Token con permisos: ads_read, ads_management, pages_read_engagement, pages_read_user_content, instagram_basic, instagram_manage_insights.</li>
            <li>Convierte el token de corta duración en uno de larga duración (60 días) desde el mismo Explorer.</li>
            <li>Obtén tu Ad Account ID en Business Settings → Cuentas publicitarias (formato act_XXXXXXXXXX).</li>
            <li>Obtén el Facebook Page ID desde la configuración de tu página, y el Instagram Business ID vinculando la cuenta de Instagram a la página de Facebook.</li>
          </ol>
        </Panel>

        <Panel title="Cómo obtener tus credenciales de TikTok">
          <ol className="text-sm text-foreground/90 space-y-2 list-decimal list-inside">
            <li>Crea una app en developers.tiktok.com → Manage apps → Create an app.</li>
            <li>Agrega el producto &ldquo;Login Kit&rdquo; y solicita los scopes <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">user.info.stats</code> y <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">video.list</code> (TikTok revisa y aprueba cada scope).</li>
            <li>Completa el flujo OAuth de la cuenta de TikTok Business de la marca para obtener un Access Token y su Open ID.</li>
            <li>El Access Token de TikTok expira — revisa en la documentación el flujo de refresh token para renovarlo antes de que caduque.</li>
          </ol>
        </Panel>

        <Panel title="Cómo obtener tus credenciales de LinkedIn">
          <ol className="text-sm text-foreground/90 space-y-2 list-decimal list-inside">
            <li>Crea una app en developer.linkedin.com/apps, asociada a la Página de empresa de la marca.</li>
            <li>Solicita acceso al producto &ldquo;Community Management API&rdquo; (o Marketing Developer Platform) — LinkedIn revisa y aprueba caso a caso, puede tardar días.</li>
            <li>Una vez aprobado, genera un Access Token con scopes <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">r_organization_social</code> y <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">r_organization_followers</code>.</li>
            <li>El Organization URN lo encuentras en la URL del admin de tu Página de LinkedIn (formato urn:li:organization:XXXXXXXX).</li>
          </ol>
        </Panel>
      </div>
    </div>
  );
}
