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
- **UI Components:** 자체 구현
- **Markdown Rendering:** @uiw/react-markdown-preview
- **Security:** rehype-sanitize

### Backend
- **API Routes:** Next.js API Routes
- **Database:** MongoDB 6.19.0
- **Authentication:** JWT (jsonwebtoken 9.0.2)
- **Password Hashing:** bcrypt 6.0.0
- **AI Model Server:** Ollama (로컬)

### Development Tools
- **Bundler:** Turbopack (Next.js 15)
- **Linting:** ESLint 9
- **PostCSS:** PostCSS 처리기

## 📁 프로젝트 구조

```
gpt/
├── app/                          # Next.js App Router
│   ├── layout.js                 # Root 레이아웃
│   ├── page.js                   # 메인 채팅 페이지 (499 lines)
│   ├── login/page.js             # 로그인 페이지
│   ├── signup/page.js            # 회원가입 페이지
│   ├── components/
│   │   └── LoadingSpinner.js     # 로딩 스피너 컴포넌트
│   └── api/                      # API Routes
│       ├── auth/
│       │   ├── login/route.js    # 로그인 API
│       │   └── register/route.js # 회원가입 API
│       └── generate/
│           ├── route.js          # AI 응답 생성 API (145 lines)
│           └── route copy.js     # 백업 파일
├── lib/                          # 공통 라이브러리
│   ├── auth.js                   # 인증 유틸리티
│   ├── mongo.js                  # MongoDB 연결
│   └── ollama.js                 # Ollama 엔드포인트 관리 (32 lines)
├── public/                       # 정적 파일
├── .env.local                    # 환경변수
├── start-ollama-instances.sh     # Ollama 인스턴스 시작 스크립트 (54 lines)
└── 설정 파일들 (next.config.mjs, package.json 등)
```

## 🔧 핵심 기능

### 1. **멀티 모델 지원**
```javascript
// app/page.js:17-20
const modelOptions = [
  { id: "gpt-oss:20b",  label: "빠른속도" },   // 빠른 응답, 저사양 모델
  { id: "gpt-oss:120b", label: "성능우선" },   // 느리지만 고성능 모델
];
```

### 2. **다중 채팅방 시스템**
- 최대 5개 채팅방 지원
- 각 방별 독립적인 대화 기록
- 실시간 방 이름 편집 (최대 8자)
- SessionStorage를 통한 클라이언트 사이드 저장

### 3. **Ollama 로드 밸런싱**
```bash
# start-ollama-instances.sh에서 5개 인스턴스 실행
# 20B 모델: 포트 11435, 11436, 11437
# 120B 모델: 포트 11531, 11532
```

```javascript
// lib/ollama.js:27-32 - 라운드로빈 로드 밸런싱
export function getNextOllamaEndpoint() {
  if (endpoints.length === 0) initOllamaEndpoints();
  const ep = endpoints[cursor];
  cursor = (cursor + 1) % endpoints.length;
  return ep;
}
```

### 4. **실시간 스트리밍 응답**
- Server-Sent Events 방식의 스트리밍
- 실시간 응답 중단 기능
- 응답 누적 및 즉시 표시

### 5. **인증 시스템**
- JWT 기반 인증 (7일 만료)
- bcrypt 패스워드 해싱
- MongoDB 사용자 관리

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

## 🔒 보안 구현

### 1. **인증 & 인가**
```javascript
// app/api/generate/route.js:15-27
const authHeader = request.headers.get("authorization");
if (!authHeader?.startsWith("Bearer ")) {
  return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
}
```

### 2. **XSS 방지**
```javascript
// app/page.js:62 - Markdown 렌더링 시 sanitization
const plugins = useMemo(() => [rehypeSanitize], []);
```

### 3. **환경변수 분리**
```env
# .env.local
MONGODB_URI=mongodb://127.0.0.1:27017/gpt
JWT_SECRET=YOUR_SUPER_SECRET_32_OR_MORE_CHARS
OLLAMA_ENDPOINTS=https://localhost:11434
```

## 🚀 실행 방법

### 1. **의존성 설치**
```bash
npm install
```

### 2. **환경별 설정**

#### 🔧 **개발환경 (Development)**
단일 Ollama 인스턴스에서 gemma2:1b 모델 사용
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
|------|---------|---------|
| **모델** | gemma2:1b | gpt-oss:20b, gpt-oss:120b |
| **인스턴스** | 1개 (11434) | 5개 (11435-11437, 11531-11532) |
| **UI** | 단일 모델 표시 | 모델 선택 토글 |
| **성능** | 경량, 빠른 테스트 | 고성능, 로드밸런싱 |

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
2. **API Route** → JWT 토큰 검증
3. **Load Balancer** → 라운드로빈으로 Ollama 인스턴스 선택  
4. **Ollama** → AI 모델 응답 생성 (스트리밍)
5. **Database** → 질문/답변 MongoDB 저장
6. **Client** → 실시간 응답 표시

### 2. **성능 최적화**
- React.memo()를 통한 컴포넌트 렌더링 최적화
- useMemo, useCallback 훅 활용
- Ollama 모델 Warm-up으로 초기 응답 지연 최소화

## 📊 성능 특성

### 환경별/모델별 특성

#### 개발환경
- **gemma2:1b**: 경량 모델, 빠른 테스트, 단일 인스턴스 (11434)

#### 실제환경  
- **gpt-oss:20b**: 빠른 응답속도, 3개 인스턴스 (11435-11437)
- **gpt-oss:120b**: 고성능 응답, 2개 인스턴스 (11531-11532)

### 최적화 기법
- 라운드로빈 로드 밸런싱으로 부하 분산
- 스트리밍 응답으로 체감 속도 향상
- 컴포넌트 메모이제이션으로 리렌더링 최소화

## 🛠️ 개발 고려사항

### 장점
1. **로컬 실행**: 데이터 보안성 확보
2. **다중 모델**: 용도별 모델 선택 가능
3. **로드 밸런싱**: 5개 인스턴스로 동시 요청 처리
4. **실시간 UI**: 스트리밍 응답으로 즉각적 피드백
5. **다중 채팅방**: 주제별 대화 관리

### 개선 가능 영역
1. **에러 핸들링**: API 실패 시 더 세밀한 에러 처리
2. **캐싱**: 빈번한 질문에 대한 응답 캐싱 시스템
3. **모니터링**: Ollama 인스턴스 상태 모니터링
4. **UI/UX**: 모바일 반응형 최적화

## 📝 코드 품질

### 코딩 스타일
- ES6+ 모던 자바스크립트 사용
- 함수형 컴포넌트 및 Hooks 패턴
- 한국어 주석 및 UI 텍스트
- Tailwind CSS를 통한 일관된 스타일링

### 아키텍처 패턴
- Next.js App Router 패턴
- API Routes를 통한 백엔드 로직 분리
- 클라이언트 상태 관리 (SessionStorage)
- 컴포넌트 기반 설계

## 🎯 결론

이 프로젝트는 **Enterprise급 로컬 AI 채팅 시스템**으로, 다음과 같은 특징을 가집니다:

- ✅ **보안**: 로컬 실행으로 데이터 유출 위험 없음
- ✅ **성능**: 로드 밸런싱을 통한 고가용성 확보  
- ✅ **사용자 경험**: 실시간 스트리밍 및 다중 채팅방
- ✅ **확장성**: 모듈화된 구조로 기능 확장 용이
- ✅ **유지보수성**: 현대적 기술 스택과 깔끔한 코드 구조

**디지털서비스개발부**의 내부 AI 도구로서 높은 실용성과 확장 가능성을 보여주는 잘 설계된 애플리케이션입니다.