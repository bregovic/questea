import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");

  const locations = await prisma.locationCheckIn.findMany({
    where: { 
      userId: session.user.id,
      ...(taskId ? { taskId } : {})
    },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(locations);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await req.json();
    const location = await prisma.locationCheckIn.create({
      data: {
        userId: session.user.id,
        taskId: data.taskId || null,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
        placeName: data.placeName,
        note: data.note,
        photoUrl: data.photoUrl,
        mileage: data.mileage ? parseFloat(data.mileage) : null,
      }
    });

    // Revalidate the blog if taskId exists
    if (data.taskId) {
      // Find the task slug first to revalidate both ID and Slug paths
      const task = await prisma.task.findUnique({ where: { id: data.taskId } });
      if (task) {
        if (task.slug) revalidatePath(`/blog/${task.slug}`);
        revalidatePath(`/blog/${task.id}`);
      }
    }

    return NextResponse.json(location);
  } catch (error) {
    return NextResponse.json({ error: "Failed to save location" }, { status: 500 });
  }
}
