import { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { sendVerificationRequest } from "@/lib/email";

import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  // @ts-ignore - PrismaAdapter types can sometimes complain with different versions
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt"
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Heslo", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Špatné přihlašovací údaje");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        // Prisma type might be missing password if client hasn't regenerated, we cast any
        const anyUser = user as any;

        if (!anyUser || !anyUser.password) {
          throw new Error("Špatné přihlašovací údaje");
        }

        const bcrypt = await import("bcryptjs");
        const passwordsMatch = await bcrypt.compare(credentials.password, anyUser.password);

        if (!passwordsMatch) {
          throw new Error("Špatné přihlašovací údaje");
        }

        return user;
      }
    }),
    EmailProvider({
      server: {
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 587),
        auth: {
          user: process.env.SMTP_USER || "ja.nepalalate@gmail.com",
          pass: process.env.SMTP_PASS || "dyaangpuyukbkbgb",
        },
      },
      from: process.env.SMTP_FROM || "ja.nepalalate@gmail.com",
      sendVerificationRequest,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
