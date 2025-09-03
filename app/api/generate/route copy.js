import { NextResponse } from "next/server";
import { getMongoClient } from "@/lib/mongo";
import jwt from "jsonwebtoken";

/* ---------- ① 모델별 기본 프롬프트 (중앙집중형) ---------- */
const DEFAULT_PROMPTS = {
  "gpt-oss:20b": "가능한 경우 모든 답변을 한국어로 설명해 주세요.",
  "gpt-oss:120b": "가능한 경우 모든 답변을 한국어로 설명해 주세요.",
};

export async function POST(request) {
  try {
    /* ---------- ② JWT 검증 (기존) ---------- */
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return NextResponse.json({ error: "잘못된 토큰" }, { status: 401 });
    }
    const userId = payload.sub;
    const userEmail = payload.email;

    /* ---------- ③ 클라이언트 페이로드 ---------- */
    const clientPayload = await request.json();
    const {
      roomId,
      model,          // 클라이언트가 선택한 모델 ID
      question,
      prompt,         // (선택적) 클라이언트가 직접 보낸 프롬프트
      ...ollamaPayload
    } = clientPayload;

    /* ---------- ④ 기본 프롬프트와 클라이언트 프롬프트 합성 ---------- */
    const basePrompt = DEFAULT_PROMPTS[model] || "";
    const finalPrompt = `${basePrompt}\n${prompt || ""}`.trim();

    /* ---------- ⑤ Ollama 스트리밍 요청 ---------- */
    const ollamaRes = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: finalPrompt,      // ← 여기서 합성된 프롬프트 사용
        stream: true,
        ...ollamaPayload,
      }),
    });

    /* ---------- ⑥ 스트림 읽으며 전체 답변 누적 ---------- */
    const stream = new ReadableStream({
      async start(controller) {
        const reader = ollamaRes.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let leftover = "";
        let assistantFullText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          leftover += decoder.decode(value, { stream: true });
          const lines = leftover.split("\n");
          leftover = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            controller.enqueue(new TextEncoder().encode(line + "\n"));
            try {
              const parsed = JSON.parse(line);
              if (parsed.response !== undefined) {
                assistantFullText += parsed.response;
              }
            } catch {
              console.warn("[/api/generate] JSON parse error:", line);
        }
          }
        }

        if (leftover) {
          controller.enqueue(new TextEncoder().encode(leftover));
          try {
            const last = JSON.parse(leftover);
            if (last.response) assistantFullText += last.response;
          } catch {}
        }
        controller.close();

        /* ---------- ⑦ DB 저장 (프롬프트는 저장 안 함) ---------- */
        try {
          const client = await getMongoClient();
          const col = client.db("gpt").collection("messages");

          // ① 질문 저장 (프롬프트 제외)
          const userQuestion =
            typeof question === "string"
              ? question
              : clientPayload.prompt?.split("\n").pop() ?? "";

          await col.insertOne({
            userId,
            email: userEmail,
            roomId: roomId || null,
            model,                // 모델 정보는 저장 (선택사항)
            role: "user",
            text: userQuestion,
            createdAt: new Date(),
          });

          // ② 어시스턴트 전체 답변 저장 (프롬프트 제외)
          await col.insertOne({
            userId,
            email: userEmail,
            roomId: roomId || null,
            model,
            role: "assistant",
            text: assistantFullText,
            createdAt: new Date(),
          });
        } catch (dbErr) {
          console.error("[/api/generate] MongoDB 저장 실패:", dbErr);
        }
      },
    });

    /* ---------- ⑧ 최종 스트림 응답 반환 ---------- */
    return new Response(stream, {
      status: ollamaRes.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[/api/generate] 서버 에러:", err);
    return NextResponse.json(
      { error: "프록시 요청 실패", details: err.message },
      { status: 500 }
    );
  }
}