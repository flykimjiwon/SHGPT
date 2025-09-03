# GPT Chat Application (Ollama-powered) - 프로젝트 분석 보고서

## 📋 프로젝트 개요

**프로젝트명:** gpt  
**버전:** 0.1.0  
**타입:** Next.js 15 기반 웹 애플리케이션  
**목적:** 로컬 Ollama 서버를 활용한 AI 채팅 인터페이스

이 프로젝트는 **디지털서비스개발부**에서 사용하는 내부 AI 채팅 시스템으로, 로컬 환경에서 Ollama를 통해 GPT 모델을 실행하고 다중 채팅방을 지원하는 웹 애플리케이션입니다.

## 🏗️ 기술 스택 & 아키텍처

### Frontend
- **Framework:** Next.js 15.5.0 (App Router)
- **React:** 19.1.0
- **CSS Framework:** Tailwind CSS v4
- **UI Library:** Lucide React 0.542.0 (아이콘)
- **Markdown Rendering:** @uiw/react-markdown-preview 5.1.5
- **Security:** rehype-sanitize 6.0.0

### Backend
- **API Routes:** Next.js API Routes
- **Database:** MongoDB 6.19.0
- **Authentication:** JWT (jsonwebtoken 9.0.2)
- **Password Hashing:** bcrypt 6.0.0
- **AI Model Server:** Ollama (로컬)

### Development Tools
- **Bundler:** Turbopack (Next.js 15)
- **Linting:** ESLint 9
- **PostCSS:** @tailwindcss/postcss

## 📁 프로젝트 구조

```
gpt/
├── app/                          # Next.js App Router
│   ├── layout.js                 # Root 레이아웃
│   ├── page.js                   # 메인 채팅 페이지 (500+ lines)
│   ├── globals.css              # 전역 스타일 (154 lines)
│   ├── login/page.js             # 로그인 페이지
│   ├── signup/page.js            # 회원가입 페이지 (135 lines)
│   ├── components/
│   │   └── LoadingSpinner.js     # 로딩 스피너 컴포넌트
│   └── api/                      # API Routes
│       ├── auth/
│       │   ├── login/route.js    # 로그인 API
│       │   └── register/route.js # 회원가입 API
│       ├── models/route.js       # 모델 옵션 API (26 lines)
│       └── generate/
│           └── route.js          # AI 응답 생성 API (193 lines)
├── lib/                          # 공통 라이브러리
│   ├── auth.js                   # 인증 유틸리티
│   ├── mongo.js                  # MongoDB 연결
│   ├── ollama.js                 # Ollama 엔드포인트 관리 (85 lines)
│   └── ip.js                     # IP 주소 처리 유틸리티 (98 lines)
├── config/                       # 설정 파일
│   └── prompts.json             # 외부 프롬프트 설정 (49 lines)
├── public/                       # 정적 파일
├── .env.local.dev               # 개발환경 설정
├── .env.local.prod              # 실제환경 설정
├── start-ollama-instances.sh     # Ollama 인스턴스 시작 스크립트 (54 lines)
└── 설정 파일들 (next.config.mjs, package.json 등)
```

## 🔧 핵심 기능

### 1. **환경별 멀티 모델 지원**
```javascript
// lib/ollama.js:8-22
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

### 2. **외부 프롬프트 시스템**
- `config/prompts.json`에서 모델별 시스템 프롬프트 관리
- 회사 정보 및 개발자 정보 포함
- 동적 프롬프트 리로드 지원 (`?reload_prompts=true`)
```javascript
// config/prompts.json:21-22
"- 이 웹사이트를 만든 사람이 누구인지 묻는다면: '디지털서비스개발부 라이프셀의 김지원이 개발했습니다.'"
```

### 3. **다중 채팅방 시스템**
- 최대 5개 채팅방 지원
- 각 방별 독립적인 대화 기록
- 실시간 방 이름 편집 (최대 8자)
- SessionStorage를 통한 클라이언트 사이드 저장

### 4. **Ollama 로드 밸런싱**
```bash
# start-ollama-instances.sh에서 5개 인스턴스 실행
# 20B 모델: 포트 11435, 11436, 11437
# 120B 모델: 포트 11531, 11532
```

```javascript
// lib/ollama.js:80-85 - 라운드로빈 로드 밸런싱
export function getNextOllamaEndpoint() {
  if (endpoints.length === 0) initOllamaEndpoints();
  const ep = endpoints[cursor];
  cursor = (cursor + 1) % endpoints.length;
  return ep;
}
```

### 5. **개선된 UI/UX**
- **접을 수 있는 사이드바**: 16px(접힘) ↔ 320px(펼침)
- **마우스 호버 전환**: 마우스 오버/아웃으로 자동 전환
- **사용자 정보 표시**: JWT에서 추출한 이메일 표시
- **로딩 중 인터랙션 차단**: AI 응답 중 모든 클릭/입력 차단
- **다크 모드 텍스트 개선**: 강제 #24292F 색상 적용

### 6. **실시간 스트리밍 응답**
- Server-Sent Events 방식의 스트리밍
- 실시간 응답 중단 기능
- 응답 누적 및 즉시 표시

### 7. **인증 시스템**
- JWT 기반 인증 (7일 만료)
- bcrypt 패스워드 해싱
- MongoDB 사용자 관리

### 8. **IP 추적 및 보안**
- 클라이언트 IP 주소 추출 (프록시/CDN 고려)
- 로컬/사설 IP 식별
- IP 정보 MongoDB 저장

## 💾 데이터베이스 구조

### MongoDB Collections

**1. users**
```javascript
{
  _id: ObjectId,
  email: String,
  passwordHash: String (bcrypt)
}
```

**2. messages**
```javascript
{
  userId: ObjectId,
  email: String,
  roomId: String,
  model: String, // "gpt-oss:20b" | "gpt-oss:120b" | "gemma3:1b"
  role: "user" | "assistant", 
  text: String,
  clientIP: String, // 클라이언트 IP 주소
  ipInfo: {
    isLocal: Boolean,   // 로컬 IP 여부 (127.0.0.1, ::1)
    isPrivate: Boolean  // 사설 IP 여부 (10.x, 172.16-31.x, 192.168.x)
  },
  createdAt: Date
}
```

## 🎨 UI/UX 개선 사항

### 1. **스타일링 시스템**
```css
/* app/globals.css - 다크 모드 텍스트 강제 적용 */
.markdown-content * {
  color: #24292F !important; /* Force dark text in all modes */
}
```

### 2. **사이드바 시스템**
- **접힘 상태**: 16px 너비, 아이콘만 표시
- **펼침 상태**: 320px 너비, 전체 정보 표시
- **호버 인터랙션**: 마우스 진입/이탈로 자동 전환
- **사용자 정보**: 이메일, 로그아웃 버튼 표시

### 3. **인터랙션 차단**
```javascript
// AI 응답 중 전체 화면 인터랙션 차단
{loading && (
  <div className="fixed inset-0 bg-transparent z-[100] cursor-not-allowed" 
       style={{ pointerEvents: 'auto' }}
       onClick={(e) => e.preventDefault()}
  />
)}
```

## 🔒 보안 구현

### 1. **인증 & 인가**
```javascript
// app/api/generate/route.js:47-57
const authHeader = request.headers.get("authorization");
if (!authHeader?.startsWith("Bearer ")) {
  return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
}
```

### 2. **XSS 방지**
```javascript
// app/page.js - Markdown 렌더링 시 sanitization
const plugins = useMemo(() => [rehypeSanitize], []);
```

### 3. **환경변수 분리**
```env
# .env.local
MONGODB_URI=mongodb://127.0.0.1:27017/gpt
JWT_SECRET=YOUR_SUPER_SECRET_32_OR_MORE_CHARS
OLLAMA_ENDPOINTS=https://localhost:11434
```

### 4. **IP 보안 처리**
```javascript
// lib/ip.js - 실제 클라이언트 IP 추출 및 검증
export function getClientIP(request) {
  // x-forwarded-for, x-real-ip 등 다양한 헤더 검사
  // 프록시/로드밸런서 환경 고려
}
```

## 🚀 실행 방법

### 1. **의존성 설치**
```bash
npm install
```

### 2. **환경별 설정**

#### 🔧 **개발환경 (Development)**
단일 Ollama 인스턴스에서 gemma3:1b 모델 사용
```bash
# 개발환경으로 전환
npm run env:dev

# 개발환경에서 실행
npm run dev        # 개발 서버 (자동으로 개발환경 적용)
npm run build:dev  # 개발환경 빌드
npm run start:dev  # 개발환경 프로덕션 서버
```

#### 🏭 **실제환경 (Production)**  
다중 Ollama 인스턴스로 로드밸런싱하여 gpt-oss 모델 사용
```bash
# 실제환경으로 전환
npm run env:prod

# Ollama 인스턴스 시작 (실제환경만)
chmod +x start-ollama-instances.sh
./start-ollama-instances.sh

# 실제환경에서 실행  
npm run dev:prod     # 실제환경 개발 서버
npm run build:prod   # 실제환경 빌드
npm run start:prod   # 실제환경 프로덕션 서버
```

### 3. **환경별 특징**

| 구분 | 개발환경 | 실제환경 |
|------|---------|------------|
| **모델** | gemma3:1b | gpt-oss:20b, gpt-oss:120b |
| **인스턴스** | 1개 (11434) | 5개 (11435-11437, 11531-11532) |
| **UI** | 단일 모델 표시 | 모델 선택 토글 |
| **성능** | 경량, 빠른 테스트 | 고성능, 로드밸런싱 |
| **프롬프트** | 테스트용 프롬프트 | 회사 정보 포함 프롬프트 |

### 4. **환경 파일 구조**
```
📁 프로젝트/
├── .env.local.dev      # 개발환경 설정
├── .env.local.prod     # 실제환경 설정  
└── .env.local          # 현재 활성화된 환경 (자동 생성)
```

## 🔄 작업 흐름

### 1. **채팅 메시지 처리 과정**
1. **Client** → 사용자 입력 및 모델 선택
2. **API Route** → JWT 토큰 검증 + IP 추출
3. **Prompt System** → 외부 JSON에서 모델별 프롬프트 로드
4. **Load Balancer** → 라운드로빈으로 Ollama 인스턴스 선택  
5. **Ollama** → AI 모델 응답 생성 (스트리밍)
6. **Database** → 질문/답변 MongoDB 저장 (IP 정보 포함)
7. **Client** → 실시간 응답 표시 (인터랙션 차단)

### 2. **성능 최적화**
- React.memo()를 통한 컴포넌트 렌더링 최적화
- useMemo, useCallback 훅 활용
- Ollama 모델 Warm-up으로 초기 응답 지연 최소화
- 라운드로빈 로드 밸런싱으로 부하 분산
- 스트리밍 응답으로 체감 속도 향상

## 📊 성능 특성

### 환경별/모델별 특성

#### 개발환경
- **gemma3:1b**: 경량 모델, 빠른 테스트, 단일 인스턴스 (11434)

#### 실제환경  
- **gpt-oss:20b**: 빠른 응답속도, 3개 인스턴스 (11435-11437)
- **gpt-oss:120b**: 고성능 응답, 2개 인스턴스 (11531-11532)

### 최적화 기법
- 라운드로빈 로드 밸런싱으로 부하 분산
- 스트리밍 응답으로 체감 속도 향상
- 컴포넌트 메모이제이션으로 리렌더링 최소화
- 외부 프롬프트 시스템으로 런타임 설정 변경

## 🛠️ 개발 고려사항

### 장점
1. **로컬 실행**: 데이터 보안성 확보
2. **다중 모델**: 용도별 모델 선택 가능
3. **로드 밸런싱**: 5개 인스턴스로 동시 요청 처리
4. **실시간 UI**: 스트리밍 응답으로 즉각적 피드백
5. **다중 채팅방**: 주제별 대화 관리
6. **외부 프롬프트**: 코드 수정 없이 프롬프트 변경
7. **향상된 UX**: 접을 수 있는 사이드바, 인터랙션 차단
8. **IP 추적**: 보안 감사 및 모니터링

### 개선 가능 영역
1. **에러 핸들링**: API 실패 시 더 세밀한 에러 처리
2. **캐싱**: 빈번한 질문에 대한 응답 캐싱 시스템
3. **모니터링**: Ollama 인스턴스 상태 모니터링
4. **UI/UX**: 모바일 반응형 최적화
5. **채팅 기록**: 서버 사이드 채팅 기록 동기화

## 📝 코드 품질

### 코딩 스타일
- ES6+ 모던 자바스크립트 사용
- 함수형 컴포넌트 및 Hooks 패턴
- 한국어 주석 및 UI 텍스트
- Tailwind CSS를 통한 일관된 스타일링
- TypeScript 없이도 명확한 코드 구조

### 아키텍처 패턴
- Next.js App Router 패턴
- API Routes를 통한 백엔드 로직 분리
- 클라이언트 상태 관리 (SessionStorage)
- 컴포넌트 기반 설계
- 환경별 설정 분리

## 🎯 최신 업데이트 (2025)

### 주요 개선 사항
1. **외부 프롬프트 시스템**: `config/prompts.json`으로 프롬프트 외부화
2. **사이드바 UI 개선**: 호버 기반 접기/펼치기 기능
3. **인터랙션 차단**: AI 응답 중 전체 인터랙션 차단
4. **다크 모드 텍스트**: 강제 색상 적용으로 가독성 개선
5. **IP 추적 시스템**: 클라이언트 IP 추출 및 보안 정보 저장
6. **JWT 정보 활용**: 토큰에서 사용자 이메일 추출 및 표시

### 기술적 향상
- Next.js 15.5.0, React 19.1.0 최신 버전
- Tailwind CSS v4 도입
- 환경별 모델 설정 자동화
- 프롬프트 동적 리로드 지원
- 로딩 상태 통합 관리

## 🎯 결론

이 프로젝트는 **Enterprise급 로컬 AI 채팅 시스템**으로, 다음과 같은 특징을 가집니다:

- ✅ **보안**: 로컬 실행으로 데이터 유출 위험 없음
- ✅ **성능**: 로드 밸런싱을 통한 고가용성 확보  
- ✅ **사용자 경험**: 실시간 스트리밍, 다중 채팅방, 직관적 UI
- ✅ **확장성**: 모듈화된 구조로 기능 확장 용이
- ✅ **유지보수성**: 현대적 기술 스택과 깔끔한 코드 구조
- ✅ **운영 편의성**: 외부 설정 파일로 코드 수정 없는 설정 변경
- ✅ **감사 추적**: IP 기반 접근 로그 및 사용자 활동 추적

**디지털서비스개발부**의 내부 AI 도구로서 높은 실용성과 확장 가능성을 보여주는 잘 설계된 애플리케이션입니다.