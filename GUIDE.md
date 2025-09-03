# 🔍 GPT Chat Application 기능 분석 가이드

## 📋 목차
1. [멀티턴 대화 시스템](#1-멀티턴-대화-시스템)
2. [인증 및 사용자 관리](#2-인증-및-사용자-관리)
3. [다중 채팅방 시스템](#3-다중-채팅방-시스템)
4. [환경별 모델 관리](#4-환경별-모델-관리)
5. [실시간 스트리밍](#5-실시간-스트리밍)
6. [로드 밸런싱](#6-로드-밸런싱)
7. [데이터베이스 관리](#7-데이터베이스-관리)
8. [IP 추적 시스템](#8-ip-추적-시스템)
9. [UI/UX 컴포넌트](#9-uiux-컴포넌트)
10. [보안 기능](#10-보안-기능)

---

## 1. 멀티턴 대화 시스템

### 🔄 **구현 방식**
멀티턴 대화는 **컨텍스트 윈도우** 방식으로 구현되어 있습니다.

#### **핵심 로직** (`app/page.js:329-333`)
```javascript
const recentContext = messages
  .slice(-3)                    // 최근 3턴의 대화만 유지
  .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
  .join("\n");
const fullPrompt = `${recentContext}\nUser: ${userMsg.text}\nAssistant:`;
```

#### **특징**
- ✅ **제한적 컨텍스트**: 최근 3턴의 대화만 유지 (메모리 효율성)
- ✅ **세션별 독립성**: 각 채팅방마다 독립적인 대화 히스토리
- ✅ **실시간 업데이트**: 새로운 메시지가 즉시 컨텍스트에 반영

#### **데이터 흐름**
1. **메시지 저장**: SessionStorage에 채팅방별 히스토리 저장
2. **컨텍스트 생성**: 최근 3개 메시지를 프롬프트로 변환
3. **AI 전송**: 컨텍스트를 포함한 프롬프트를 Ollama에 전송
4. **응답 처리**: AI 응답을 히스토리에 추가

---

## 2. 인증 및 사용자 관리

### 🔐 **JWT 기반 인증 시스템**

#### **회원가입 프로세스** (`app/api/auth/register/route.js`)
```javascript
// 1. 이메일 중복 확인
// 2. bcrypt로 비밀번호 해시화
const hashedPassword = await bcrypt.hash(password, 10);
// 3. MongoDB에 사용자 정보 저장
```

#### **로그인 프로세스** (`app/api/auth/login/route.js`)
```javascript
// 1. 이메일로 사용자 조회
// 2. bcrypt로 비밀번호 검증
const match = await bcrypt.compare(password, user.passwordHash);
// 3. JWT 토큰 발급 (7일 만료)
const token = jwt.sign({ sub: user._id, email: user.email }, secret, { expiresIn: '7d' });
```

#### **토큰 검증** (`lib/auth.js`)
```javascript
export function verifyToken(request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader.split(' ')[1];
  return jwt.verify(token, process.env.JWT_SECRET);
}
```

#### **클라이언트 사이드 보호** (`app/page.js:221-225`)
```javascript
useEffect(() => {
  if (!localStorage.getItem('token')) {
    router.replace('/login');  // 토큰 없으면 로그인 페이지로 리다이렉트
  }
}, [router]);
```

---

## 3. 다중 채팅방 시스템

### 🏠 **방 관리 시스템**

#### **방 생성/삭제/수정** (`app/page.js:283-310`)
```javascript
// 방 추가 (최대 5개)
const addRoom = () => {
  const newId = `room-${Date.now()}`;
  const newRoom = { id: newId, name: "New Chat" };
  setRooms(prev => [...prev, newRoom]);
};

// 방 삭제 (최소 1개 유지)
const deleteRoom = (roomId) => {
  if (rooms.length <= 1) return;
  sessionStorage.removeItem(`chatHistory_${roomId}`);
};

// 방 이름 수정 (최대 8자)
const renameRoom = (roomId, newName) => {
  const trimmed = newName.trim().slice(0, 8);
};
```

#### **데이터 저장 구조**
```javascript
// SessionStorage 키 구조
chatRooms                    // 방 목록: [{id, name}, ...]
chatHistory_{roomId}         // 방별 대화기록: [{role, text}, ...]
```

#### **UI 구현** (`app/page.js:108-166`)
- **가로 스크롤**: 방 목록을 가로로 스크롤 가능
- **실시간 수정**: 인라인 방 이름 편집
- **제한 로직**: 최대 5개 방, 최소 1개 방 유지

---

## 4. 환경별 모델 관리

### 🔧 **Dynamic Model Configuration**

#### **환경별 모델 설정** (`lib/ollama.js:8-22`)
```javascript
export const MODEL_CONFIG = {
  development: {
    models: [{ id: "gemma3:1b", label: "Gemma 3 1B" }],
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
```

#### **환경 감지** (`lib/ollama.js:27-29`)
```javascript
export function getEnvironment() {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}
```

#### **API 엔드포인트** (`app/api/models/route.js`)
```javascript
// GET /api/models - 현재 환경의 모델 옵션 반환
{
  models: [...],
  defaultModel: "...",
  environment: "development" | "production"
}
```

#### **클라이언트 동적 로드** (`app/page.js:190-218`)
```javascript
useEffect(() => {
  async function loadModelOptions() {
    const response = await fetch('/api/models');
    const data = await response.json();
    setModelOptions(data.models);
    setSelectedModel(data.defaultModel);
  }
}, []);
```

---

## 5. 실시간 스트리밍

### 📡 **Server-Sent Events 기반 스트리밍**

#### **스트림 처리 로직** (`app/page.js:340-400`)
```javascript
// 1. AbortController로 중단 가능한 요청 생성
const controller = new AbortController();

// 2. ReadableStream으로 실시간 응답 읽기
const reader = res.body.getReader();
const decoder = new TextDecoder("utf-8");

// 3. 청크 단위로 응답 처리
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  // 4. JSON 파싱 및 UI 업데이트
  const parsed = JSON.parse(line);
  if (parsed.response !== undefined) {
    setMessages(prev => {
      copy[idx].text += parsed.response;  // 실시간 누적
    });
  }
}
```

#### **서버 사이드 스트림** (`app/api/generate/route.js:63-100`)
```javascript
const stream = new ReadableStream({
  async start(controller) {
    const reader = ollamaRes.body.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Ollama 응답을 클라이언트로 실시간 전달
      controller.enqueue(new TextEncoder().encode(line + "\n"));
    }
  }
});
```

#### **중단 기능** (`app/page.js:447-451`)
```javascript
const stopStreaming = useCallback(() => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();  // 요청 중단
  }
  setLoading(false);
}, []);
```

---

## 6. 로드 밸런싱

### ⚖️ **라운드로빈 로드 밸런서**

#### **엔드포인트 관리** (`lib/ollama.js:52-73`)
```javascript
export function initOllamaEndpoints() {
  const raw = process.env.OLLAMA_ENDPOINTS || "";
  endpoints = raw.split(",").map(e => e.trim()).filter(Boolean);
  
  if (endpoints.length === 0) {
    // 개발환경 기본값
    endpoints = ['http://localhost:11434'];
  }
}
```

#### **라운드로빈 알고리즘** (`lib/ollama.js:78-83`)
```javascript
let cursor = 0;
export function getNextOllamaEndpoint() {
  if (endpoints.length === 0) initOllamaEndpoints();
  const ep = endpoints[cursor];
  cursor = (cursor + 1) % endpoints.length;  // 순환
  return ep;
}
```

#### **실제 운영 환경**
```bash
# start-ollama-instances.sh
# gpt-oss:20b - 3개 인스턴스 (빠른 응답)
ollama serve --port 11435 &
ollama serve --port 11436 &
ollama serve --port 11437 &

# gpt-oss:120b - 2개 인스턴스 (고성능)
ollama serve --port 11531 &
ollama serve --port 11532 &
```

---

## 7. 데이터베이스 관리

### 🗄️ **MongoDB 연결 및 스키마**

#### **싱글톤 연결** (`lib/mongo.js`)
```javascript
let client;  // 전역 싱글톤

export async function getMongoClient() {
  if (!client) {
    client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();
  }
  return client;
}
```

#### **Users 컬렉션**
```javascript
{
  _id: ObjectId,
  email: String,           // 유니크 인덱스
  passwordHash: String     // bcrypt 해시
}
```

#### **Messages 컬렉션**
```javascript
{
  userId: ObjectId,        // users._id 참조
  email: String,           // 중복 저장 (빠른 조회)
  roomId: String,          // 채팅방 ID
  model: String,           // 사용한 AI 모델
  role: "user"|"assistant",
  text: String,            // 메시지 내용
  clientIP: String,        // 🆕 클라이언트 IP
  ipInfo: {                // 🆕 IP 메타데이터
    isLocal: Boolean,
    isPrivate: Boolean
  },
  createdAt: Date
}
```

---

## 8. IP 추적 시스템

### 🌐 **클라이언트 IP 추출**

#### **다중 헤더 지원** (`lib/ip.js`)
```javascript
export function getClientIP(request) {
  // 1. x-forwarded-for (프록시 체인)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  
  // 2. x-real-ip (nginx)
  // 3. x-client-ip
  // 4. cf-connecting-ip (Cloudflare)
  // 5. x-cluster-client-ip
  
  return '127.0.0.1';  // fallback
}
```

#### **IP 분석** (`lib/ip.js:68-85`)
```javascript
export function getIPInfo(ip) {
  return {
    ip: normalizedIP,
    isLocal: normalizedIP === '127.0.0.1' || normalizedIP === '::1',
    isPrivate: isPrivateIP(normalizedIP)  // 10.x, 172.16-31.x, 192.168.x
  };
}
```

#### **데이터베이스 저장** (`app/api/generate/route.js:116-129`)
```javascript
await col.insertOne({
  // ... 기존 필드들
  clientIP: normalizedIP,
  ipInfo: {
    isLocal: ipInfo.isLocal,
    isPrivate: ipInfo.isPrivate
  },
  createdAt: new Date(),
});
```

---

## 9. UI/UX 컴포넌트

### 🎨 **React 컴포넌트 구조**

#### **메모이제이션 최적화**
```javascript
// 입력창 컴포넌트 (memo)
const ChatInput = memo(function ChatInput({ ... }) { ... });

// 마크다운 렌더링 (memo + useMemo)
const SafeMarkdown = memo(function SafeMarkdown({ source }) {
  const plugins = useMemo(() => [rehypeSanitize], []);
  return <MarkdownPreview ... />;
});

// 모델 토글 (memo)
const ModelToggle = memo(function ModelToggle({ ... }) { ... });
```

#### **로딩 스피너** (`app/components/LoadingSpinner.js`)
```javascript
export default function LoadingSpinner({ onStop }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
      <div className="animate-spin border-4 border-blue-600..." />
      <button onClick={onStop}>중단</button>
    </div>
  );
}
```

#### **반응형 UI**
- **Tailwind CSS**: 일관된 스타일링
- **다크모드 지원**: `dark:` prefix 사용
- **가로 스크롤**: 채팅방 목록
- **자동 스크롤**: 새 메시지 시 하단으로 이동

---

## 10. 보안 기능

### 🛡️ **다층 보안 체계**

#### **1. 인증/인가**
```javascript
// JWT 토큰 검증 (모든 API 요청)
const authHeader = request.headers.get("authorization");
if (!authHeader?.startsWith("Bearer ")) {
  return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
}
```

#### **2. XSS 방지**
```javascript
// Markdown 렌더링 시 sanitization
import rehypeSanitize from "rehype-sanitize";
const plugins = useMemo(() => [rehypeSanitize], []);
```

#### **3. 환경 변수 분리**
```env
# 민감한 정보는 환경 변수로 관리
MONGODB_URI=...
JWT_SECRET=...
OLLAMA_ENDPOINTS=...
```

#### **4. 패스워드 해싱**
```javascript
// bcrypt 단방향 암호화 (소금값 10)
const hashedPassword = await bcrypt.hash(password, 10);
```

#### **5. 클라이언트 검증**
```javascript
// 브라우저에서 토큰 확인
useEffect(() => {
  if (!localStorage.getItem('token')) {
    router.replace('/login');
  }
}, [router]);
```

---

## 🔄 전체 데이터 흐름

```mermaid
graph TB
    User[사용자] --> Login[로그인]
    Login --> JWT[JWT 토큰 발급]
    JWT --> Main[메인 채팅 페이지]
    
    Main --> Room[채팅방 선택/생성]
    Room --> Message[메시지 입력]
    Message --> API[/api/generate]
    
    API --> Auth[JWT 검증]
    Auth --> IP[IP 추출]
    IP --> Ollama[Ollama 라운드로빈]
    Ollama --> Stream[실시간 스트리밍]
    Stream --> DB[MongoDB 저장]
    DB --> UI[UI 업데이트]
```

---

## 📊 성능 최적화 기법

1. **React 최적화**
   - `memo()`: 불필요한 리렌더링 방지
   - `useCallback()`: 함수 메모이제이션
   - `useMemo()`: 값 메모이제이션

2. **네트워크 최적화**
   - 스트리밍: 체감 응답 속도 향상
   - 로드 밸런싱: 요청 부하 분산

3. **저장소 최적화**
   - SessionStorage: 클라이언트 사이드 캐싱
   - MongoDB 싱글톤: 연결 재사용

4. **메모리 관리**
   - 제한적 컨텍스트: 최근 3턴만 유지
   - AbortController: 불필요한 요청 중단

---

이 가이드는 GPT Chat Application의 모든 주요 기능과 구현 방식을 상세히 분석한 기술 문서입니다. 각 기능은 독립적으로 작동하면서도 유기적으로 연결되어 완전한 AI 채팅 시스템을 구성하고 있습니다.