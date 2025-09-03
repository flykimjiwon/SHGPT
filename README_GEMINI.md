# 프로젝트 분석: Ollama 기반 AI 챗봇

## 1. 프로젝트 개요

이 프로젝트는 Next.js(App Router)를 기반으로 구축된 웹 기반 AI 챗봇 애플리케이션입니다. 로컬에서 실행되는 대규모 언어 모델(LLM)을 Ollama 서비스를 통해 연동하여, 사용자에게 실시간 스트리밍 채팅 경험을 제공합니다. 주요 기능으로는 사용자 인증(회원가입, 로그인), 다중 채팅방 관리, 모델 선택(성능 vs 속도) 등이 있습니다.

## 2. 기술 스택

- **프레임워크**: Next.js 15 (Turbopack 사용)
- **프론트엔드**: React 19, Tailwind CSS
- **백엔드**: Next.js API Routes (Node.js)
- **데이터베이스**: MongoDB (채팅 내역 및 사용자 정보 저장)
- **AI 모델**: Ollama를 통해 로컬 LLM (e.g., `gpt-oss:20b`, `gpt-oss:120b`) 서빙
- **인증**: JWT (JSON Web Tokens) 및 `bcrypt`를 사용한 비밀번호 해싱
- **UI/UX**: Markdown 렌더링(`@uiw/react-markdown-preview`), 실시간 스트리밍 응답 처리

## 3. 시스템 아키텍처

1.  **클라이언트 (Next.js Frontend)**: 사용자는 웹 인터페이스를 통해 질문을 입력하고 모델을 선택합니다. 요청은 JWT 토큰과 함께 `/api/generate` 엔드포인트로 전송됩니다.
2.  **API 라우트 (Next.js Backend)**:
    - JWT 토큰을 검증하여 사용자를 인증합니다.
    - `lib/ollama.js`의 라운드-로빈 방식에 따라 현재 요청을 처리할 Ollama 인스턴스 URL을 선택합니다.
    - 사용자의 프롬프트를 Ollama 서버로 전달하고, 스트리밍 응답을 다시 클라이언트로 중계합니다.
3.  **Ollama 서비스**:
    - `start-ollama-instances.sh` 스크립트를 통해 여러 포트에서 다수의 Ollama 인스턴스가 실행됩니다. (예: 20B 모델 3개, 120B 모델 2개)
    - 이는 모델별 요청을 분산 처리하여 부하를 줄이고 응답성을 높이는 역할을 합니다.
4.  **데이터베이스 (MongoDB)**:
    - 스트리밍이 완료된 후, 사용자의 질문과 AI의 전체 답변이 `messages` 컬렉션에 저장됩니다.
    - 사용자 계정 정보는 `users` 컬렉션에 저장됩니다.

## 4. 주요 기능 상세

### a. 실시간 스트리밍 채팅 (`app/page.js`)

- 사용자가 질문을 제출하면, 서버로부터 스트리밍되는 응답을 실시간으로 화면에 렌더링합니다.
- `ReadableStream`과 `TextDecoder`를 사용하여 서버 응답을 한 줄씩 파싱하고 즉시 UI에 반영합니다.
- 요청 중에는 로딩 스피너와 함께 '응답 중단' 기능을 제공합니다.

### b. 다중 채팅방 및 대화 기록 관리

- 사용자는 세션 스토리지(`sessionStorage`)를 통해 여러 채팅방을 생성, 삭제, 이름 변경할 수 있습니다. (최대 5개)
- 각 방의 대화 내용은 별도의 세션 스토리지 키(`chatHistory_{roomId}`)에 저장되어 방을 전환할 때마다 복원됩니다.

### c. Ollama 인스턴스 라운드-로빈 (`lib/ollama.js`)

- `.env.local`에 정의된 여러 Ollama 엔드포인트 주소를 관리합니다.
- `getNextOllamaEndpoint()` 함수는 호출될 때마다 다음 엔드포인트를 순차적으로 반환하여 여러 인스턴스에 요청을 고르게 분산시킵니다.

### d. 사용자 인증 및 DB 연동

- **API (`/api/generate`)**: 요청 헤더의 `Authorization: Bearer <token>`을 검증하여 인가된 사용자만 AI 서비스를 이용할 수 있도록 제한합니다.
- **DB 저장**: AI 응답이 완료되면, 해당 대화(질문 및 답변)를 사용자의 ID, 이메일과 함께 MongoDB에 영구적으로 기록합니다.

## 5. 설정 및 실행 방법

1.  **의존성 설치**:
    ```bash
    npm install
    ```

2.  **환경 변수 설정**:
    프로젝트 루트에 `.env.local` 파일을 생성하고 다음 변수들을 설정합니다.

    ```env
    # MongoDB 연결 문자열
    MONGODB_URI="mongodb://user:password@host:port/database"

    # JWT 서명에 사용할 시크릿 키
    JWT_SECRET="your-super-secret-key"

    # 실행할 Ollama 인스턴스들의 주소 (쉼표로 구분)
    OLLAMA_ENDPOINTS="http://localhost:11435,http://localhost:11436,http://localhost:11437,http://localhost:11531,http://localhost:11532"
    ```

3.  **Ollama 인스턴스 실행**:
    Ollama가 설치되어 있어야 합니다. 다음 셸 스크립트를 실행하여 여러 Ollama 서버 인스턴스를 백그라운드에서 실행하고 모델을 미리 로드합니다.

    ```bash
    # 스크립트에 실행 권한 부여
    chmod +x ./start-ollama-instances.sh

    # 스크립트 실행
    ./start-ollama-instances.sh
    ```

4.  **개발 서버 실행**:
    Next.js 개발 서버를 시작합니다.

    ```bash
    npm run dev
    ```

    이제 브라우저에서 `http://localhost:3000`으로 접속하여 애플리케이션을 사용할 수 있습니다.
