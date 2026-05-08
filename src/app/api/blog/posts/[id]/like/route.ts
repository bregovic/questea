import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headerList = await headers();
    const ip = headerList.get("x-forwarded-for")?.split(",")[0] || "0.0.0.0";

    // Check if like exists
    const existingLike = await prisma.postLike.findUnique({
      where: {
        taskId_ipAddress: {
          taskId: id,
          ipAddress: ip
        }
      }
    });

    if (existingLike) {
      // Unlike
      await prisma.postLike.delete({
        where: { id: existingLike.id }
      });
      return NextResponse.json({ liked: false });
    } else {
      // Like
      await prisma.postLike.create({
        data: {
          taskId: id,
          ipAddress: ip
        }
      });
      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    console.error("Like error:", error);
    return NextResponse.json({ error: "Failed to process like" }, { status: 500 });
  }
}
