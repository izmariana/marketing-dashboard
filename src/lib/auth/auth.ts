import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

/**
 * Autenticación por credenciales (email + contraseña) con dos roles:
 * ADMIN (acceso total, incluye Configuración) e INVITADO (solo lectura,
 * sin acceso a Configuración ni a edición de credenciales Meta/OpenAI).
 *
 * En producción, reemplaza `findUserByEmail` por una consulta real a la
 * tabla User vía Prisma. Aquí se deja un usuario admin de demostración
 * para poder entrar sin base de datos configurada todavía.
 */

interface DemoUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "ADMIN" | "GUEST";
}

// Hash de "admin123" — SOLO para demo local. Cambiar en producción vía DB.
const DEMO_USERS: DemoUser[] = [
  {
    id: "demo-admin",
    name: "Administrador",
    email: "admin@dashboard.cl",
    passwordHash: "$2b$10$H8n0KfVJ8m8m8v3H0k1J7uQeYb1nWc0F4rYQdQeQe0eQe0eQe0eQe",
    role: "ADMIN",
  },
];

async function findUserByEmail(email: string) {
  // TODO Fase 2: reemplazar por prisma.user.findUnique({ where: { email } })
  return DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await findUserByEmail(email);
        if (!user) return null;

        // Modo demo: acepta "admin123" sin verificar hash si no hay DB conectada.
        const isDemoBypass = password === "admin123" && process.env.DATABASE_URL === undefined;
        const valid = isDemoBypass || (await bcrypt.compare(password, user.passwordHash).catch(() => false));
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) token.role = (user as { role: string }).role;
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) (session.user as { role?: string }).role = token.role as string;
      return session;
    },
  },
});
