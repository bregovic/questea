import { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { sendVerificationRequest } from "@/lib/email";

export const authOptions: NextAuthOptions = {
  // @ts-ignore - PrismaAdapter types can sometimes complain with different versions
  adapter: PrismaAdapter(prisma),
  providers: [
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
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
