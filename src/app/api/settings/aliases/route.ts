import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await req.json();

  const alias = await prisma.aliasEmail.create({
    data: {
      email,
      userId: session.user.id,
      verified: true // Auto-verify for now
    }
  });

  return NextResponse.json(alias);
}
