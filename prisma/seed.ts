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

  // Usuario administrador real — contraseña: admin123 (cámbiala apenas puedas)
  const adminEmail = "admin@dashboard.cl";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        name: "Administrador",
        email: adminEmail,
        passwordHash: "$2b$10$lylYE4VUE0igPcVQD7HmqevkM8ojlv9Q27ug4G/pExzPIFEtqDCJa",
        role: "ADMIN",
      },
    });
    console.log(`Usuario administrador creado: ${adminEmail} (contraseña: admin123)`);
  } else {
    console.log("Usuario administrador ya existía, no se modificó.");
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
