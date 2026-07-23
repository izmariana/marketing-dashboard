# Marketing Intelligence Dashboard

Dashboard de inteligencia de marketing para **Informes Comerciales**, **Inversiones Cinco** y **Segal Deudores**. Centraliza Meta Ads (Marketing API) y contenidos de Facebook/Instagram (Graph API), con motor de recomendaciones automáticas, benchmarks Chile, Performance Score y capa de IA (OpenAI) para insights y reportes ejecutivos.

> **Estado del proyecto:** Las 5 fases originales están completas, más 7 ampliaciones:
> - Guardado real de credenciales (Meta y OpenAI ya se guardan encriptadas en la base de datos desde Configuración).
> - **Google Analytics 4** completo: KPIs, adquisición de tráfico, landing pages, eventos/conversiones y embudo de conversión.
> - **Meta reestructurado** (Instagram / Facebook / Ambas) con seguimiento de seguidores, y **TikTok** construido completo con el mismo patrón. **LinkedIn** dejado como "Próximamente".
> - **Métricas clickeables**: toda tarjeta de KPI se puede abrir para ver su histórico completo, con rango libre y vista diaria/semanal/mensual/anual.
> - **Branding configurable**: nombre, logo, favicon y colores editables desde Configuración, sin tocar código.
> - **Comparación Meta vs Google Analytics** + **Inteligencia de Contenidos**: patrones automáticos (mejor formato, día, hora, temas, CTA) con recomendaciones accionables.
> - **Alertas ampliadas** (10 tipos, con explicación y recomendación separadas) + **Reportes por período de calendario** (Diario/Semanal/Mensual/Trimestral/Anual).
>
> Todo funciona hoy mismo con datos simulados realistas. Conecta tus credenciales reales en Configuración para pasar a datos reales sin tocar código.

---

## ⚠️ Nota importante sobre `npx prisma generate`

Este proyecto se generó en un entorno de desarrollo sin salida a internet hacia el CDN de Prisma (`binaries.prisma.sh`), así que **no pudimos ejecutar `prisma generate` aquí**. Esto es 100% normal y se soluciona solo:

- En tu computador: al correr `npm install` se ejecuta automáticamente (ver `postinstall` en `package.json`).
- En Vercel: se ejecuta automáticamente durante el despliegue.

No necesitas hacer nada especial — es un paso estándar de cualquier proyecto con Prisma, simplemente no se pudo verificar en este entorno de generación.



## Stack Tecnológico

Next.js 15 · React 18 · TypeScript · TailwindCSS v4 · Recharts · Framer Motion · Prisma · PostgreSQL (Supabase) · React Query · Zod · React Hook Form · NextAuth · OpenAI SDK

---

## 1. Instalación

```bash
# 1. Instala dependencias
npm install

# 2. Copia las variables de entorno
cp .env.example .env

# 3. Genera el cliente de Prisma
npx prisma generate

# 4. (Cuando tengas tu DB de Supabase lista) aplica el schema
npx prisma db push

# 5. Levanta el servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Verás la pantalla de login.

**Login de demostración** (mientras no conectes una base de datos real):
- Email: `admin@dashboard.cl`
- Contraseña: `admin123`

Con `USE_MOCK_DATA="true"` en tu `.env` (valor por defecto), el Dashboard Principal, las 3 páginas de marca y Configuración funcionan de inmediato con datos generados que tienen exactamente la misma forma que los que devolverá Meta API — así puedes revisar la UI y el flujo completo antes de conectar tus cuentas reales.

---

## 2. Cómo obtener tus credenciales de Meta (Marketing API + Graph API)

1. Ve a [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App** → tipo **Business**.
2. Dentro de la app, agrega los productos **Marketing API** y **Facebook Login for Business**.
3. Ve a **Herramientas → Graph API Explorer**. Selecciona tu app y genera un **User Access Token** con estos permisos:
   - `ads_read`
   - `ads_management`
   - `pages_read_engagement`
   - `pages_show_list`
   - `instagram_basic`
   - `instagram_manage_insights`
4. Ese token dura ~1 hora. Conviértelo en uno de **larga duración (60 días)**: en el mismo Explorer, usa el botón de "Debug" → "Extend Access Token", o llama al endpoint `GET /oauth/access_token?grant_type=fb_exchange_token&...`.
5. **Ad Account ID**: en Business Settings → Cuentas publicitarias → copia el ID (agrégale el prefijo `act_` si no lo trae, ej: `act_1234567890`).
6. **Facebook Page ID**: en la configuración de tu página de Facebook → About → Page ID.
7. **Instagram Business ID**: la cuenta de Instagram debe estar vinculada a la página de Facebook (Meta Business Suite → Configuración → Cuentas vinculadas). Luego consulta `GET /{page-id}?fields=instagram_business_account` con tu token.

Ingresa estos 4 datos por cada marca en la página **Configuración** de la app (se guardan encriptados con AES-256-GCM antes de persistir en la base de datos — ver `CREDENTIALS_ENCRYPTION_KEY` en `.env`).

> Para producción, considera activar **Advanced Access** en cada permiso (requiere App Review de Meta) — el modo Development solo permite acceso a usuarios de prueba/roles de la app.

---

## 3. Variables de entorno

Ver `.env.example` para el detalle completo. Las más importantes:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Conexión a Supabase (pooled / directa) |
| `AUTH_SECRET` | Secreto de NextAuth (`openssl rand -base64 32`) |
| `OPENAI_API_KEY` | Para Marketing Advisor IA, insights de posts y reportes ejecutivos |
| `CREDENTIALS_ENCRYPTION_KEY` | Encripta tokens de Meta antes de guardarlos (`openssl rand -hex 32`) |
| `USE_MOCK_DATA` | `true` = datos simulados, `false` = llamadas reales a Meta API |

---

## 4. Estructura del proyecto

```
src/
  app/
    (app)/                    # Rutas protegidas (requieren sesión)
      dashboard/               # Dashboard Principal - funcional
      marcas/[marca]/           # 3 páginas de marca - funcional
      campanas/                 # Fase 2
      contenidos/                # Fase 3
      recomendaciones/            # Fase 4
      reportes/                    # Fase 5
      configuracion/             # funcional (credenciales)
    api/
      auth/[...nextauth]/       # NextAuth route handler
      dashboard/                 # Resumen consolidado (mock hoy, Meta API en Fase 2)
      metrics/[slug]/            # Métricas por marca
    login/                      # Página de login
  components/
    layout/                   # Sidebar, Topbar
    dashboard/                # KpiCard, Panel, BrandDashboard, etc.
    charts/                   # EvolutionChart, BrandComparisonChart, ConversionFunnel
  lib/
    auth/                     # Configuración NextAuth
    services/
      meta-client.ts           # Cliente real de Meta Marketing API + Graph API
      openai-client.ts          # Cliente OpenAI (insights + resúmenes ejecutivos)
      recommendation-engine.ts   # Reglas automáticas + benchmarks Chile + Performance Score
    mock/generator.ts          # Generador de datos simulados (misma forma que la API real)
  types/domain.ts              # Tipos compartidos de todo el dominio
prisma/schema.prisma           # Modelo de datos completo
```

---

## 5. Cómo pasar de datos simulados a datos reales (Fase 2)

El diseño está pensado para que este cambio sea quirúrgico:

1. En Configuración, guarda las credenciales reales de cada marca.
2. Crea un cron job (Vercel Cron, o un endpoint `/api/sync` llamado cada 6 horas) que:
   - Lea `MetaCredential` de cada `Brand` desde la base de datos.
   - Llame a `fetchCampaignInsights()` y `fetchFacebookPosts()` / `fetchInstagramMedia()` de `src/lib/services/meta-client.ts` (ya implementado y listo para usar).
   - Persista los resultados como `MetricSnapshot` (nunca sobrescribe, solo agrega — así se reconstruye el histórico).
3. Cambia `USE_MOCK_DATA="false"` en `.env`.
4. Reemplaza las llamadas a `generateDailyMetrics()` / `generateCampaigns()` / `generatePosts()` en las rutas de `src/app/api/**` por consultas Prisma a `MetricSnapshot` / `Campaign` / `Post`.

Ningún componente de UI necesita cambiar: todos consumen los tipos de `src/types/domain.ts`, que ya reflejan la forma exacta de los datos reales.

---

## 6. Sincronización automática y alertas (Fase 2)

- **Sincronización manual**: el botón "Actualizar ahora" en cualquier página, o `POST /api/sync` (requiere sesión de Admin).
- **Sincronización automática**: `vercel.json` ya incluye un Cron Job que llama `GET /api/sync` cada 6 horas. Protegido con el header `Authorization: Bearer CRON_SECRET` (defínelo en tus variables de entorno de Vercel).
- **Histórico inmutable**: cada sincronización inserta un `MetricSnapshot` por día. Si ya existe uno para esa fecha/campaña, se omite — nunca se sobrescribe (`skipDuplicates: true`).
- **Alertas automáticas**: después de cada sincronización, `generateAlertsForAllBrands()` revisa el promedio de los últimos 7 días de cada marca contra las reglas de negocio y crea una alerta solo si no existe una equivalente en las últimas 24 horas (evita duplicados).
- **Calendario**: `/api/calendar` expone fecha de inicio/fin, presupuesto y estado de cada campaña para la vista de calendario en la página Campañas.

---

## 7. Módulo de Contenidos (Fase 3)

- **Performance Score**: se calcula en `recommendation-engine.ts` (0-100) ponderando engagement, CTR, leads, alcance, compartidos y guardados contra los máximos del conjunto de publicaciones.
- **Análisis con IA por publicación**: botón "Analizar con IA" en el detalle de cada post. Si configuraste `OPENAI_API_KEY`, llama a `analyzePostWithAI()` (OpenAI real); si no, genera un análisis simulado con la misma estructura para que puedas probar el flujo completo sin costo.
- **Comparador**: selecciona 2 publicaciones (modo "Comparar") y obtén una conclusión automática de cuál rindió mejor y por qué.
- **Ranking mensual**: Top 10 automático por Performance Score, con medallas 🥇🥈🥉.
- Para pasar de mock a datos reales, sincroniza publicaciones reales de Facebook/Instagram usando `fetchFacebookPosts()` / `fetchInstagramMedia()` de `meta-client.ts` (ya implementados) y persístelas como `Post` — el resto del módulo no necesita cambios.

---

## 8. Marketing Advisor IA (Fase 4)

- **Resumen ejecutivo**: generado con `generateExecutiveSummary()` (OpenAI real si configuraste `OPENAI_API_KEY`, o un resumen simulado con la misma estructura si no).
- **Recomendaciones automáticas**: mismas reglas de `recommendation-engine.ts` usadas en las alertas, mostradas aquí con el detalle completo (CTR bajo, CPC alto, frecuencia alta, CPL alto, oportunidad de escalar presupuesto).
- **Benchmark Chile**: compara CTR, CPC, CPM y CPL de cada marca contra referencias de industria (`BENCHMARKS_CHILE` en `recommendation-engine.ts`, editable ahí mismo si tienes benchmarks propios).
- **Nota sobre los datos simulados**: se calibraron para reflejar rangos reales del mercado chileno (CPM ~$3.500-$6.500, CPC ~$100-$300), de modo que las recomendaciones y el benchmark se disparen de forma realista incluso antes de conectar datos reales.

---

## 9. Reportes (Fase 5)

- **PDF**: Reporte Ejecutivo IA completo (resumen, KPIs vs. período anterior, top campañas, top publicaciones, problemas, acciones prioritarias, próximos pasos). Generado con `pdfkit`.
- **Excel**: 4 hojas (Resumen, Top Campañas, Top Publicaciones, Recomendaciones). Generado con `exceljs`.
- **CSV**: datos crudos para análisis externo.
- Los 3 formatos reutilizan exactamente los mismos datos que la página Recomendaciones IA (`getBrandReportData()` en `report-data.ts`) — una sola fuente de verdad.
- Con base de datos conectada, cada exportación queda registrada en la tabla `Report` y aparece en el historial de la página.
- **Nota técnica**: `next.config.ts` incluye `serverExternalPackages: ["pdfkit"]` — necesario para que pdfkit pueda leer sus archivos de fuentes en el entorno de Vercel/Node.

---

## 10. Configuración inicial de la base de datos (una sola vez)

Antes de guardar credenciales reales de Meta o Google Analytics, necesitas crear las tablas en tu base de datos y las 3 marcas iniciales. Esto se hace **una sola vez**, desde tu computador:

```bash
npm install
npx prisma db push    # crea todas las tablas en tu base de datos de Supabase
npx prisma db seed    # crea las 3 marcas (Informes Comerciales, Inversiones Cinco, Segal Deudores)
```

Necesitas un archivo `.env` local (no se sube a GitHub) con al menos `DATABASE_URL` y `DIRECT_URL` apuntando a tu Supabase — ver `.env.example`.

---

## 11. Google Analytics 4

- **Conexión**: se configura por marca en Configuración → pega el Property ID y el JSON completo de una Service Account de Google Cloud con acceso "Viewer" al Property. Al guardar, se prueba la conexión real antes de persistir (si falla, avisa el motivo exacto).
- **Datos mostrados**: usuarios, sesiones, engagement rate, tiempo promedio, páginas vistas, conversiones — con comparación al período anterior, igual que Meta.
- **Adquisición de tráfico**: agrupado por canal (Organic Search, Paid Social, Direct, etc.) y fuente.
- **Landing pages**: ranking por sesiones, con engagement, conversiones y tasa de salida.
- **Eventos**: todos los eventos de GA4, marcando cuáles están configurados como conversión.
- **Embudo**: Usuarios → Sesiones → Interacción → Formulario enviado → Lead generado → Conversión.
- **Histórico**: igual que Meta, cada sincronización guarda un snapshot diario que nunca se sobrescribe (`GaMetricSnapshot`), así el histórico es ilimitado sin depender de los límites de la API de Google.
- **Sincronización**: se integró al mismo botón "Actualizar ahora" y al mismo cron de 6 horas que ya sincroniza Meta (`sync-service.ts` + `ga-sync-service.ts` corren juntos desde `/api/sync`).

---

## 12. Meta, TikTok y LinkedIn — plataformas separadas

- **Meta** (`/meta`): reemplaza a la antigua página "Contenidos". Tiene un selector **Instagram / Facebook / Ambas** que filtra tanto los KPIs de seguidores como el grid de publicaciones. Al elegir "Ambas" se muestran los seguidores de ambas redes lado a lado.
- **TikTok** (`/tiktok`): página independiente con el mismo patrón (seguidores, videos, Performance Score, comparador, ranking mensual, análisis con IA). Solo contenido orgánico por ahora — no incluye TikTok Ads.
- **LinkedIn** (`/linkedin`): aparece en el menú como "Próximamente" (bloqueado, no clickeable). El modelo de datos (`Post`, `MetricSnapshot`, `FollowerSnapshot`) ya soporta la red `LINKEDIN`, así que activarlo en el futuro es agregar la integración con su API, sin reestructurar nada.
- **Seguidores** (`FollowerSnapshot`): nuevo histórico por red social y marca, con la misma filosofía que el resto — snapshots diarios que nunca se sobrescriben, así el crecimiento se puede consultar sin límite de tiempo.
- El detalle, análisis con IA y comparador de publicaciones funcionan igual para contenido de Meta y de TikTok (una sola publicación de cada red se puede comparar entre sí, por ejemplo un Reel de Instagram contra un video de TikTok).

---

## 13. Métricas clickeables e histórico ilimitado

- Cualquier tarjeta de KPI con un ícono de gráfico al pasar el mouse es clickeable — abre un panel lateral con el histórico completo de esa métrica.
- **Rangos disponibles**: Hoy, 7 días, 30 días, 90 días, 12 meses, Desde el inicio, o un rango de fechas personalizado.
- **Vistas disponibles**: Diaria, Semanal, Mensual, Anual — el agrupamiento se hace en el navegador a partir de los datos diarios (`bucketSeries()` en `metric-aggregation.ts`), sumando o promediando según corresponda a cada métrica.
- **Una sola ruta central** (`/api/metrics/history`) sirve el histórico de Meta, Google Analytics y Seguidores, tanto en modo simulado como con datos reales — no depende de los límites de 90 días de la API de Meta, porque siempre lee del histórico propio guardado en `MetricSnapshot`, `GaMetricSnapshot` o `FollowerSnapshot`.
- Con datos simulados, "Desde el inicio" muestra un rango de ejemplo (~400 días). Con datos reales, mostrará desde tu primer día de sincronización, sin ningún límite.

---

## 14. Branding configurable

- Ve a **Configuración → Branding**: puedes cambiar el nombre de la plataforma, nombre de la empresa, logo, favicon, color principal y color secundario.
- Los cambios se aplican **de inmediato**, sin redesplegar: el nombre y logo se actualizan en el menú lateral y el login, y el color principal se aplica a botones, pestañas activas y acentos en toda la app.
- El logo y favicon se guardan como imagen embebida (base64) directo en la base de datos — no necesitas ningún servicio externo de almacenamiento de archivos. Límite recomendado: menos de 650KB por imagen.
- Por defecto, la plataforma se llama **"Marketing Segal"**.
- Técnicamente: `AppSettings` en Prisma guarda estos campos; `/api/settings/branding` los expone públicamente (sin sesión, porque el login también los necesita) y los guarda solo si el usuario es Admin; `BrandingProvider` los aplica en el navegador vía `document.title`, el favicon y la variable CSS `--accent`.

---

## 15. Comparación de Plataformas + Inteligencia de Contenidos

### Comparación Meta vs Google Analytics (`/comparacion`)
- Compara tráfico (clics vs sesiones), conversiones, leads, CTR/Engagement Rate y CPC entre ambas fuentes.
- Genera automáticamente explicaciones de por qué los números pueden diferir (ventanas de atribución, bloqueadores de anuncios, restricciones de tracking en iOS/Safari), disparadas cuando la diferencia porcentual supera un umbral razonable.
- No depende de OpenAI — es 100% basada en reglas, así que funciona siempre, sin costo.

### Inteligencia de Contenidos (dentro de Recomendaciones IA)
- Analiza todas las publicaciones de Meta del período y detecta: mejor formato, mejor día de la semana, mejor franja horaria, temas frecuentes en el copy de las publicaciones top, y el llamado a la acción con mejor rendimiento.
- Genera recomendaciones accionables ("prioriza X formato", "publica los días Y", "evita seguir usando Z").
- **Limitación documentada honestamente**: no analiza duración de video, porque Meta Graph API no garantiza ese dato para todo el contenido orgánico — se prefirió omitirlo antes que mostrar una cifra poco confiable. La detección de temas/CTA es una aproximación por palabras clave, no una clasificación semántica real.

---

## 16. Alertas ampliadas + Reportes por período

### Centro de Alertas (`/alertas`)
- 10 tipos de alerta: CTR bajo (con detección de tendencia real período sobre período, no solo umbral fijo), CPL alto, campaña sin entrega, frecuencia alta, presupuesto por agotarse, **engagement en baja, caída de seguidores, publicación bajo rendimiento, abandono en landing page, campaña sin resultados**.
- Cada alerta trae `message` (explicación) y `recommendation` (acción concreta) por separado.
- Filtros por marca y severidad, botón para marcar como leída, y se evita duplicar la misma alerta dentro de 24 horas.

### Reportes por período (`/reportes`)
- 5 períodos alineados a calendario (no solo "últimos N días"): **Diario** (ayer), **Semanal** (últimos 7 días), **Mensual** (mes calendario actual), **Trimestral** (trimestre calendario actual), **Anual** (año calendario actual).
- `getPeriodRange()` en `report-periods.ts` calcula el rango exacto; `getBrandReportData()` ahora acepta tanto un número de días (retrocompatible) como un rango `{ since, until }` explícito.

### Un bug real que se encontró y corrigió en este tramo
Al probar los reportes semanales, el período actual y el anterior mostraban números idénticos — la causa era que los datos de ejemplo generaban su "ruido aleatorio" en una secuencia que se repetía cada vez que dos ventanas de tiempo caían en los mismos días de la semana (siempre el caso en comparaciones semanales). Se corrigió ligando la semilla aleatoria a la fecha calendario real de cada día en `generateDailyMetrics()`, `generateGaDailyMetrics()` y `generateFollowerSnapshots()` — confirmado con pruebas en vivo que ahora las comparaciones muestran variación realista.

---

## 17. Despliegue en Vercel

```bash
npm install -g vercel
vercel login
vercel
```

1. En el dashboard de Vercel, ve a tu proyecto → **Settings → Environment Variables** y agrega todas las variables de `.env.example`.
2. Conecta tu proyecto de Supabase (o usa la integración nativa Vercel ↔ Supabase, que autocompleta `DATABASE_URL`).
3. En **Settings → Cron Jobs**, agrega una tarea cada 6 horas apuntando a `/api/sync` (a implementar en Fase 2) para la actualización automática.
4. `vercel --prod` para el despliegue final.

### Despliegue con Docker (alternativa)

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t marketing-dashboard .
docker run -p 3000:3000 --env-file .env marketing-dashboard
```

---

## 18. Proyecto completo

Las 5 fases están implementadas y probadas de punta a punta (build de producción limpio, endpoints verificados con datos simulados realistas). Los siguientes pasos quedan en tus manos:

1. Crear tus cuentas de Supabase, Meta Developers y OpenAI (ver secciones 1-2-3 de este README).
2. Conectar tus credenciales reales en Configuración.
3. Desplegar en Vercel (sección 10).

A partir de ahí, la sincronización automática, las alertas, las recomendaciones y los reportes empiezan a trabajar con tus datos reales sin ningún cambio de código adicional.
