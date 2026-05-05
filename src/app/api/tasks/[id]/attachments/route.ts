import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, BUCKET_NAME, PUBLIC_URL } from "@/lib/r2";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { name, url, type } = await req.json();
    let finalUrl = url;

    // If it's a base64 image and we have R2 configured, upload it
    if (url.startsWith("data:") && process.env.R2_ENDPOINT) {
      try {
        const [header, base64Data] = url.split(",");
        const buffer = Buffer.from(base64Data, "base64");
        const contentType = header.split(":")[1].split(";")[0];
        const extension = contentType.split("/")[1] || "jpg";
        const filename = `${Date.now()}-${name.replace(/[^a-z0-9.]/gi, '_')}`;
        const key = `questea/${id}/${filename}`;

        await r2.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }));

        finalUrl = `${PUBLIC_URL}/${key}`;
      } catch (r2Error) {
        console.error("R2 Upload failed, falling back to DB storage:", r2Error);
        // Fallback to storing base64 in DB if R2 fails
      }
    }

    const attachment = await prisma.attachment.create({
      data: {
        name,
        url: finalUrl,
        type,
        taskId: id,
      },
    });
    return NextResponse.json(attachment);
  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: "Failed to upload attachment" }, { status: 500 });
  }
}
