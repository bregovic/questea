import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payees = await prisma.payee.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" }
    });
    return NextResponse.json(payees);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch payees" }, { status: 500 });
  }
}
