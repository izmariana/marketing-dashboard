import { PhasePlaceholder } from "@/components/dashboard/phase-placeholder";

export default function LinkedInPage() {
  return (
    <PhasePlaceholder
      title="LinkedIn"
      description="Arquitectura preparada para conectar LinkedIn Ads y contenido orgánico cuando lo necesites."
      phase="Próxima fase"
      items={[
        "Mismo modelo de datos que Meta y TikTok: Post, MetricSnapshot y FollowerSnapshot ya soportan la red LINKEDIN",
        "Dashboard propio con KPIs, seguidores, contenidos y engagement, igual que Meta y TikTok",
        "Integración con LinkedIn Marketing API para campañas pagadas",
        "Se activa agregando las credenciales en Configuración, sin reestructurar el proyecto",
      ]}
    />
  );
}
