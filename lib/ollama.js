let endpoints = [];

/**
 * 환경에 따른 기본 모델 매핑
 * 개발환경: gemma2:1b (단일 모델)
 * 실제환경: gpt-oss:20b, gpt-oss:120b (다중 모델)
 */
export const MODEL_CONFIG = {
  development: {
    models: [
      { id: "gemma3:1b", label: "Gemma 3 1B" }
    ],
    defaultModel: "gemma3:1b"
  },
  production: {
    models: [
      { id: "gpt-oss:20b", label: "빠른속도" },
      { id: "gpt-oss:120b", label: "성능우선" }
    ],
    defaultModel: "gpt-oss:20b"
  }
};

/**
 * 현재 환경 확인
 */
export function getEnvironment() {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

/**
 * 현재 환경에 맞는 모델 옵션 반환
 */
export function getModelOptions() {
  const env = getEnvironment();
  return MODEL_CONFIG[env].models;
}

/**
 * 현재 환경의 기본 모델 반환
 */
export function getDefaultModel() {
  const env = getEnvironment();
  return MODEL_CONFIG[env].defaultModel;
}

/**
 * .env.local 의 OLLAMA_ENDPOINTS 를 파싱해 전역 배열에 저장합니다.
 * 개발환경: http://localhost:11434 (단일 인스턴스)
 * 실제환경: 다중 인스턴스 (로드밸런싱)
 */
export function initOllamaEndpoints() {
  const raw = process.env.OLLAMA_ENDPOINTS || "";
  endpoints = raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  
  if (endpoints.length === 0) {
    // 환경별 기본 엔드포인트 설정
    const env = getEnvironment();
    if (env === 'development') {
      endpoints = ['http://localhost:11434'];
      console.log('[개발환경] 기본 Ollama 엔드포인트 사용: http://localhost:11434');
    } else {
      throw new Error(
        "OLLAMA_ENDPOINTS 가 .env.local 에 정의되지 않았습니다."
      );
    }
  }
  
  console.log(`[${getEnvironment()}] Ollama 엔드포인트 초기화:`, endpoints);
}

/**
 * 라운드‑로빈으로 다음 엔드포인트를 반환합니다.
 * 처음 호출 시 initOllamaEndpoints() 가 자동으로 실행됩니다.
 */
let cursor = 0;
export function getNextOllamaEndpoint() {
  if (endpoints.length === 0) initOllamaEndpoints();
  const ep = endpoints[cursor];
  cursor = (cursor + 1) % endpoints.length;
  return ep;
}