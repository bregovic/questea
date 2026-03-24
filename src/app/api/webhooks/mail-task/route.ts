import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    
    // Inbound webhook structure (example based on Postmark/Resend/SendGrid)
    // Extracting From, Subject, TextBody
    const fromRaw = rawBody.From || rawBody.from || "";
    const subject = rawBody.Subject || rawBody.subject || "";
    const textBody = rawBody.TextBody || rawBody.text || rawBody.body || "";
    
    // 1. Identify User
    // Extract actual email from headers like "Name <email@site.com>"
    const fromAddress = fromRaw.includes("<") ? fromRaw.match(/<(.+)>/)?.[1] : fromRaw;
    
    if (!fromAddress) {
      return NextResponse.json({ error: "No sender address" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: fromAddress },
          { aliasEmails: { some: { email: fromAddress, verified: true } } }
        ]
      },
      include: { aliasEmails: true }
    });

    if (!user) {
      console.warn(`[MailWebhook] Unauthorized sender attempt: ${fromAddress}`);
      return NextResponse.json({ error: "Unauthorized sender" }, { status: 401 });
    }

    // 2. Extract Manual Tags (XML-like)
    // <priority>HIGH</priority>
    // <deadline>2026-10-10</deadline>
    // <ai>true</ai>
    const extractTag = (tag: string) => {
      const regex = new RegExp(`<${tag}>(.+?)<\/${tag}>`, "is");
      return textBody.match(regex)?.[1]?.trim();
    };

    let priority = extractTag("priority")?.toUpperCase() || "MEDIUM";
    let dueDateStr = extractTag("deadline");
    let manualAiTag = extractTag("ai");
    
    // Check if AI is on for this alias or via tag
    const fromAlias = user.aliasEmails.find(a => a.email === fromAddress);
    let useAi = manualAiTag === "true" || (fromAlias?.allowAi && manualAiTag !== "false");

    let finalTitle = subject;
    let finalDesc = textBody.replace(/<[^>]*>.*?<[^>]*>/gs, "").trim(); 

    // 3. AI Processing (if requested)
    if (useAi && process.env.GEMINI_API_KEY) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Jsi asistent pro správu úkolů v aplikaci Questea. Tvým úkolem je analyzovat e-mail a vytvořit z něj strukturovaný úkol.
        
        Předmět: ${subject}
        Tělo e-mailu: ${textBody}
        
        Vrať POUZE čistý JSON v tomto formátu:
        {
          "title": "Stručný a jasný název úkolu (česky)",
          "description": "Stručný souhrn a zadání z těla mailu (česky)",
          "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
          "dueDate": "YYYY-MM-DD" nebo null
        }
        Analyzuj tón mailu a určete prioritu. Pokud je v mailu zmíněno datum, nastav dueDate.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const aiData = JSON.parse(jsonMatch[0]);
          finalTitle = aiData.title || finalTitle;
          finalDesc = aiData.description || finalDesc;
          priority = aiData.priority || priority;
          if (!dueDateStr) dueDateStr = aiData.dueDate;
        }
      } catch (aiError) {
        console.error("[MailWebhook] AI processing failed, falling back to manual:", aiError);
      }
    }

    // 4. Create Task
    const task = await prisma.task.create({
      data: {
        title: finalTitle,
        description: finalDesc,
        status: "TODO",
        priority: priority as any,
        userId: user.id,
        dueDate: dueDateStr ? new Date(dueDateStr) : null,
      }
    });

    console.log(`[MailWebhook] Task created for user ${user.id}: ${task.id}`);
    return NextResponse.json({ success: true, taskId: task.id });

  } catch (error) {
    console.error("[MailWebhook] Error processing inbound task:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
