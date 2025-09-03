import { NextResponse } from "next/server";
import { getMongoClient } from "@/lib/mongo";
import jwt from "jsonwebtoken";
import { getNextOllamaEndpoint } from "@/lib/ollama";
import { getClientIP, normalizeIP, getIPInfo } from "@/lib/ip";
import fs from "fs";
import path from "path";

/* ---------- ① 프롬프트 설정 로드 ---------- */
let PROMPT_CONFIG = null;

function loadPromptConfig(forceReload = false) {
  if (!PROMPT_CONFIG || forceReload) {
    try {
      const configPath = path.join(process.cwd(), 'config', 'prompts.json');
      const configFile = fs.readFileSync(configPath, 'utf-8');
      PROMPT_CONFIG = JSON.parse(configFile);
      console.log(`[프롬프트 설정] ${forceReload ? '재로드' : '로드'} 완료: config/prompts.json`);
    } catch (error) {
      console.error('프롬프트 설정 파일 로드 실패:', error);
      // 폴백 설정
      PROMPT_CONFIG = {
        systemPrompts: {},
        fallbackPrompt: ["당신은 도움이 되는 AI 어시스턴트입니다. 한국어로 답변해 주세요."]
      };
    }
  }
  return PROMPT_CONFIG;
}

function getSystemPrompt(model) {
  const config = loadPromptConfig();
  const prompts = config.systemPrompts[model] || config.fallbackPrompt;
  return Array.isArray(prompts) ? prompts.join('\n') : prompts;
}

export async function POST(request) {
  try {
    /* ---------- ② 프롬프트 리로드 (개발용) ---------- */
    const url = new URL(request.url);
    const reloadPrompts = url.searchParams.get('reload_prompts') === 'true';
    if (reloadPrompts) {
      loadPromptConfig(true);
    }

    /* ---------- ③ JWT 검증 (기존) ---------- */
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

    /* ---------- ④ 클라이언트 IP 추출 ---------- */
    const clientIP = getClientIP(request);
    const normalizedIP = normalizeIP(clientIP);
    const ipInfo = getIPInfo(normalizedIP);

    /* ---------- ⑤ 클라이언트 페이로드 ---------- */
    const {
      roomId,
      model,          // UI 에서 선택한 모델 ID
      question,
      prompt,         // (선택적) 클라이언트가 직접 보낸 프롬프트
      ...ollamaPayload
    } = await request.json();

    /* ---------- ⑥ 시스템 프롬프트와 사용자 질문 합성 ---------- */
    const systemPrompt = getSystemPrompt(model);
    const userQuestion = question || prompt || "";
    const finalPrompt = `${systemPrompt}\n\n사용자 질문: ${userQuestion}`;

    /* ---------- ⑦ 라운드‑로빈 Ollama 엔드포인트 선택 ---------- */
    const ollamaUrl = `${getNextOllamaEndpoint()}/api/generate`;

    const ollamaRes = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: finalPrompt,   // 합성된 프롬프트 사용
        stream: true,
        ...ollamaPayload,
      }),
    });

    /* ---------- ⑧ 스트림을 읽으며 전체 답변 누적 ---------- */
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

        // 남은 버퍼 처리
        if (leftover) {
          controller.enqueue(new TextEncoder().encode(leftover));
          try {
            const last = JSON.parse(leftover);
            if (last.response) assistantFullText += last.response;
          } catch {}
        }
        controller.close();

        /* ---------- ⑨ DB 저장 (시스템 프롬프트는 저장 안 함) ---------- */
        try {
          const client = await getMongoClient();
          const col = client.db("gpt").collection("messages");

          // ① 사용자 질문 저장 (시스템 프롬프트 제외)
          const userQuestion = question || prompt || "";
          
          // 시스템 프롬프트 제거 (순수한 사용자 질문만 저장)
          const cleanUserQuestion = userQuestion.replace(/^사용자 질문:\s*/, "");

          await col.insertOne({
            userId,
            email: userEmail,
            roomId: roomId || null,
            model,
            role: "user",
            text: cleanUserQuestion,
            clientIP: normalizedIP,
            ipInfo: {
              isLocal: ipInfo.isLocal,
              isPrivate: ipInfo.isPrivate
            },
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
            clientIP: normalizedIP,
            ipInfo: {
              isLocal: ipInfo.isLocal,
              isPrivate: ipInfo.isPrivate
            },
            createdAt: new Date(),
          });
        } catch (dbErr) {
          console.error("[/api/generate] MongoDB 저장 실패:", dbErr);
        }
      },
    });

    /* ---------- ⑩ 최종 스트림 응답 반환 ---------- */
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