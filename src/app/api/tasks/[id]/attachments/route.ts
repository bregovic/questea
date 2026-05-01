import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { name, url, type } = await req.json();
    const attachment = await prisma.attachment.create({
      data: {
        name,
        url, // Storing base64 for now
        type,
        taskId: id,
      },
    });
    return NextResponse.json(attachment);
  } catch (error) {
    return NextResponse.json({ error: "Failed to upload attachment" }, { status: 500 });
  }
}
