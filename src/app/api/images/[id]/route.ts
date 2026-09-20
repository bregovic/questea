import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      select: { url: true, type: true }
    });

    if (!attachment || !attachment.url) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Check if it's a base64 data URL
    if (attachment.url.startsWith("data:")) {
      const [header, base64Data] = attachment.url.split(",");
      const contentType = header.split(":")[1].split(";")[0];
      const buffer = Buffer.from(base64Data, "base64");
      
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    }

    /* `?raw=1` – data potečou přes nás místo přesměrování na veřejnou adresu R2.
       Ta neposílá Access-Control-Allow-Origin, takže fotku načtenou s
       crossOrigin="anonymous" prohlížeč zablokuje. To potřebuje fotokniha:
       bez CORS by se stránky nevykreslily a nešlo by z nich udělat PDF
       (html2canvas by narazil na „ušpiněné" plátno). Běžné zobrazení fotek
       dál jede přesměrováním, ať servírování obrázků nejde přes náš server. */
    if (new URL(request.url).searchParams.has("raw")) {
      const upstream = await fetch(attachment.url);
      if (!upstream.ok || !upstream.body) {
        return new NextResponse("Upstream error", { status: 502 });
      }
      return new NextResponse(upstream.body, {
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // If it's a regular URL, redirect to it
    return NextResponse.redirect(attachment.url);

  } catch (error) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
