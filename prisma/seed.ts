import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BRANDS = [
  { slug: "informes_comerciales" as const, name: "Informes Comerciales", themeColor: "#5B8DEF" },
  { slug: "inversiones_cinco" as const, name: "Inversiones Cinco", themeColor: "#3FBF8F" },
  { slug: "segal_deudores" as const, name: "Segal Deudores", themeColor: "#E0A63C" },
];

async function main() {
  for (const brand of BRANDS) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      create: brand,
      update: { name: brand.name, themeColor: brand.themeColor },
    });
    console.log(`Marca lista: ${brand.name}`);
  }

  // Fila única de configuración global (OpenAI key, benchmarks, etc.)
  const existingSettings = await prisma.appSettings.findFirst();
  if (!existingSettings) {
    await prisma.appSettings.create({ data: {} });
    console.log("AppSettings inicial creado.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
