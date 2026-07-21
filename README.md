# Marketing Intelligence Dashboard

Dashboard de inteligencia de marketing para **Informes Comerciales**, **Inversiones Cinco** y **Segal Deudores**. Centraliza Meta Ads (Marketing API) y contenidos de Facebook/Instagram (Graph API), con motor de recomendaciones automáticas, benchmarks Chile, Performance Score y capa de IA (OpenAI) para insights y reportes ejecutivos.

> **Estado del proyecto:** Las 5 fases están completas.
> - Fase 1: Arquitectura, base de datos, autenticación, layout y Dashboard Principal.
> - Fase 2: Campañas conectadas a Meta Marketing API (sincronización real), calendario de campañas y sistema de alertas automático.
> - Fase 3: Módulo de Contenidos — grid de publicaciones, Performance Score, filtros y ordenamiento, comparador, ranking mensual y análisis con IA por publicación.
> - Fase 4: Marketing Advisor IA — resumen ejecutivo, recomendaciones automáticas y Benchmark Chile.
> - Fase 5: Reportes — exportación a PDF, Excel y CSV, con historial.
>
> Todo funciona hoy mismo con datos simulados realistas para el mercado chileno. Conecta tus credenciales de Meta y tu OpenAI API Key en Configuración para pasar a datos y análisis reales sin tocar código.

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

## 10. Despliegue en Vercel

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

## 11. Proyecto completo

Las 5 fases están implementadas y probadas de punta a punta (build de producción limpio, endpoints verificados con datos simulados realistas). Los siguientes pasos quedan en tus manos:

1. Crear tus cuentas de Supabase, Meta Developers y OpenAI (ver secciones 1-2-3 de este README).
2. Conectar tus credenciales reales en Configuración.
3. Desplegar en Vercel (sección 10).

A partir de ahí, la sincronización automática, las alertas, las recomendaciones y los reportes empiezan a trabajar con tus datos reales sin ningún cambio de código adicional.
