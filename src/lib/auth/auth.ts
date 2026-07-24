import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";

/**
 * Autenticación por credenciales (email + contraseña) con dos roles:
 * ADMIN (acceso total, incluye Configuración) e INVITADO (solo lectura,
 * sin acceso a Configuración ni a edición de credenciales Meta/OpenAI).
 *
 * Con base de datos conectada (USE_MOCK_DATA=false), los usuarios se leen
 * de verdad desde la tabla User vía Prisma. Sin base de datos (modo
 * simulado), se usa un usuario de demostración en memoria para poder
 * probar la app sin configurar nada todavía.
 */

interface DemoUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "ADMIN" | "GUEST";
}

// Hash real de "admin123" (bcrypt) — solo se usa en modo simulado, sin DB.
const DEMO_USERS: DemoUser[] = [
  {
    id: "demo-admin",
    name: "Administrador",
    email: "admin@dashboard.cl",
    passwordHash: "$2b$10$lylYE4VUE0igPcVQD7HmqevkM8ojlv9Q27ug4G/pExzPIFEtqDCJa",
    role: "ADMIN",
  },
];

async function findUserByEmail(email: string) {
  if (isDatabaseConfigured) {
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return null;
    return { id: user.id, name: user.name, email: user.email, passwordHash: user.passwordHash, role: user.role };
  }
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

        const valid = await bcrypt.compare(password, user.passwordHash).catch(() => false);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = (user as { id: string }).id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
});
