#!/usr/bin/env bash
# -------------------------------------------------
# 1️⃣ 기존 Ollama 프로세스 정리 (우아하게, 안되면 강제)
# -------------------------------------------------
pids=$(pgrep -f "ollama.*--port")
if [[ -n "$pids" ]]; then
  echo "Stopping old Ollama processes: $pids"
  kill -SIGINT $pids 2>/dev/null || true
  sleep 2
  kill -9 $pids 2>/dev/null || true
fi

# -------------------------------------------------
# 2️⃣ 20 B 모델 – 3개의 포트
# -------------------------------------------------
ollama serve --port 11435 &
ollama serve --port 11436 &
ollama serve --port 11437 &

# -------------------------------------------------
# 3️⃣ 120 B 모델 – 2개의 포트
# -------------------------------------------------
ollama serve --port 11531 &
ollama serve --port 11532 &

# -------------------------------------------------
# 4️⃣ warm‑up (모델을 메모리/GPU에 로드)
# -------------------------------------------------
sleep 2   # 서버가 기동될 때까지 잠시 대기

curl -s -X POST http://localhost:11435/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","prompt":"warm-up","stream":false}' > /dev/null
curl -s -X POST http://localhost:11436/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","prompt":"warm-up","stream":false}' > /dev/null
curl -s -X POST http://localhost:11437/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","prompt":"warm-up","stream":false}' > /dev/null
curl -s -X POST http://localhost:11531/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:120b","prompt":"warm-up","stream":false}' > /dev/null
curl -s -X POST http://localhost:11532/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:120b","prompt":"warm-up","stream":false}' > /dev/null

echo "✅ 5개의 Ollama 인스턴스가 라운드‑로빈으로 준비되었습니다."


# # 파일에 실행 권한 부여 (한 번만 하면 됩니다)
# chmod +x scripts/start-ollama-instances.sh

# # 실행
# ./scripts/start-ollama-instances.sh