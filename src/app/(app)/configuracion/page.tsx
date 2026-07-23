"use client";

import { useState } from "react";
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
  metaAccessToken: z.string().min(20, "El token de acceso parece inválido"),
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

type BrandCredentialForm = z.infer<typeof brandCredentialSchema>;
type SettingsForm = z.infer<typeof settingsSchema>;
type GaCredentialForm = z.infer<typeof gaCredentialSchema>;

function BrandCredentialCard({ brandSlug, brandName, brandColor }: { brandSlug: string; brandName: string; brandColor: string }) {
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BrandCredentialForm>({ resolver: zodResolver(brandCredentialSchema) });

  async function onSubmit(values: BrandCredentialForm) {
    setServerError(null);
    try {
      const res = await fetch("/api/settings/meta-credentials", {
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
              placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxx"
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
      </form>
    </Panel>
  );
}

function GaCredentialCard({ brandSlug, brandName, brandColor }: { brandSlug: string; brandName: string; brandColor: string }) {
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
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

export default function ConfiguracionPage() {
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
            <li>En Herramientas → Graph API Explorer, genera un User Token con permisos: ads_read, ads_management, pages_read_engagement, instagram_basic, instagram_manage_insights.</li>
            <li>Convierte el token de corta duración en uno de larga duración (60 días) desde el mismo Explorer.</li>
            <li>Obtén tu Ad Account ID en Business Settings → Cuentas publicitarias (formato act_XXXXXXXXXX).</li>
            <li>Obtén el Facebook Page ID desde la configuración de tu página, y el Instagram Business ID vinculando la cuenta de Instagram a la página de Facebook.</li>
          </ol>
        </Panel>
      </div>
    </div>
  );
}
