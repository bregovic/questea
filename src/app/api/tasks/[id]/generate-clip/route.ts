import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { r2, BUCKET_NAME, PUBLIC_URL } from "@/lib/r2";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const tempDir = path.join(os.tmpdir(), `questea-movie-${id}-${Date.now()}`);

  try {
    // 1. Get all video attachments for this task
    const task = await prisma.task.findUnique({
      where: { id },
      include: { attachments: true }
    });

    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const videos = task.attachments.filter(a => a.type === "video");
    if (videos.length === 0) return NextResponse.json({ error: "No videos found" }, { status: 400 });

    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const processedFiles: string[] = [];

    // 2. Process each video: download and extract a 3-second clip from the middle
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const localPath = path.join(tempDir, `input-${i}.mp4`);
      const clippedPath = path.join(tempDir, `clipped-${i}.mp4`);

      // Download from R2 (or handle base64 if legacy)
      if (v.url.startsWith("http")) {
         // Assuming it's in our R2 bucket, we need to extract the key
         const key = v.url.replace(`${PUBLIC_URL}/`, "");
         const data = await r2.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
         const bodyContents = await data.Body?.transformToByteArray();
         if (bodyContents) fs.writeFileSync(localPath, Buffer.from(bodyContents));
      } else if (v.url.startsWith("data:")) {
         const base64Data = v.url.split(",")[1];
         fs.writeFileSync(localPath, Buffer.from(base64Data, "base64"));
      } else {
         continue;
      }

      // Extract 3 seconds from the middle
      await new Promise((resolve, reject) => {
        ffmpeg(localPath)
          .ffprobe((err, metadata) => {
            if (err) return reject(err);
            const duration = metadata.format.duration || 0;
            const startTime = Math.max(0, (duration / 2) - 1.5);
            
            ffmpeg(localPath)
              .setStartTime(startTime)
              .setDuration(3)
              .size('1280x720')
              .aspect('16:9')
              .autoPad(true, 'black')
              .output(clippedPath)
              .on('end', resolve)
              .on('error', reject)
              .run();
          });
      });
      processedFiles.push(clippedPath);
    }

    // 3. Concatenate all clips
    const outputPath = path.join(tempDir, 'movie-final.mp4');
    const mergeCommand = ffmpeg();
    processedFiles.forEach(f => mergeCommand.input(f));

    await new Promise((resolve, reject) => {
      mergeCommand
        .on('end', resolve)
        .on('error', reject)
        .mergeToFile(outputPath, tempDir);
    });

    // 4. Upload final movie to R2
    const movieBuffer = fs.readFileSync(outputPath);
    const movieKey = `questea/${id}/movie-${Date.now()}.mp4`;

    await r2.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: movieKey,
      Body: movieBuffer,
      ContentType: "video/mp4"
    }));

    const finalUrl = `${PUBLIC_URL}/${movieKey}`;

    // 5. Create attachment in DB
    const attachment = await prisma.attachment.create({
      data: {
        name: `Sestřih - ${task.title}`,
        url: finalUrl,
        type: "video",
        taskId: id
      }
    });

    return NextResponse.json(attachment);

  } catch (error: any) {
    console.error("Movie Generation Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate movie" }, { status: 500 });
  } finally {
    // Cleanup temp files
    try {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
}
