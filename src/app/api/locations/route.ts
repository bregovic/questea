import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locations = await prisma.locationCheckIn.findMany({
    where: { userId: session.user.id },
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
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
        placeName: data.placeName,
        note: data.note,
        photoUrl: data.photoUrl,
        mileage: data.mileage ? parseFloat(data.mileage) : null,
      }
    });
    return NextResponse.json(location);
  } catch (error) {
    return NextResponse.json({ error: "Failed to save location" }, { status: 500 });
  }
}
