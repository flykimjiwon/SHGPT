```markdown gpt/README.md
# GPT‑Chat (Ollama + Next.js + MongoDB)

**한눈에 보는 전체 흐름**  
Mac Studio (M3 Ultra + 512 GB RAM) ▶ Homebrew → Xcode CLI Tools → git → MongoDB & Compass → npm → Next.js 프로젝트 생성 → Ollama 모델 구동 → 앱 실행  

> **주의**: 이 환경은 **Docker를 사용할 수 없습니다**. 모든 의존성은 로컬에 직접 설치합니다.

---

## 1️⃣ 프로젝트 개요

| 파일/디렉터리 | 역할 |
|---------------|------|
| `app/api/auth/register/route.js` | 회원가입 (bcrypt 해시, MongoDB `users` 컬렉션) |
| `app/api/auth/login/route.js` | 로그인 (bcrypt 검증, JWT 발급) |
| `app/api/generate/route.js` | 프론트엔드 → Ollama 모델 요청 (라운드‑로빈) |
| `lib/mongo.js` | MongoDB 싱글톤 클라이언트 |
| `lib/ollama.js` | `OLLAMA_ENDPOINTS` 파싱·라운드‑로빈 헬퍼 |
| `app/login/page.js` / `app/signup/page.js` | 로그인·회원가입 UI + 토큰 로컬스토리지 저장 |
| `app/page.js` (RoomsPanel) | 방 목록 UI |
| `app/components/LoadingSpinner.js` | API 호출 시 로딩 오버레이 |
| `package.json` | 의존성·스크립트 정의 |
| `.env.local` | `MONGODB_URI`, `JWT_SECRET`, `OLLAMA_ENDPOINTS` 등 비밀값 |

> **핵심 로직** – `app/api/generate/route.js` 에서 `getNextOllamaEndpoint()` 로 **다중 Ollama 인스턴스**에 순차적으로 요청을 보냅니다. 별도 Nginx 등 프록시가 필요 없습니다.

---

## 2️⃣ 사전 준비 (Prerequisites)

| 항목 | 최소 버전 | 설치 명령 |
|------|-----------|-----------|
| **Homebrew** | 4.x | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |
| **Xcode Command Line Tools** | macOS 13 (Sequoia) 이상 | `softwareupdate --install-rosetta --agree-to-license` (자동으로 설치) |
| **git** | 2.51 | `brew install git` |
| **Node.js** | 18 LTS (추천) | `brew install node` |
| **MongoDB Community** | 7.x | `brew tap mongodb/brew && brew install mongodb-community@7.0` |
| **MongoDB Compass** (GUI) | 최신 | <https://www.mongodb.com/try/download/compass> 에서 dmg 다운로드 후 설치 |
| **Ollama** | 최신 | `brew install ollama` |

> **시간 제한**: 일부 기업 네트워크에서는 **오후 6시 이전**에 Xcode CLI Tools 다운로드가 차단될 수 있습니다. 이 경우 **오후 6시 이후**에 다시 시도하거나, 사내 IT에 요청해 다운로드 허용을 받아야 합니다.

---

## 3️⃣ Homebrew & Xcode CLI Tools 설치 상세

```bash
# 1️⃣ Homebrew 설치 (이미 설치돼 있으면 스킵)
#    비밀번호 입력 후 진행
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2️⃣ Xcode Command Line Tools 설치
#    프롬프트가 뜨면 <Enter> 를 눌러 진행
xcode-select --install

# 3️⃣ 설치 확인
brew --version          # → 4.x
git --version           # → 2.51.x
node -v                 # → v18.x (또는 최신 LTS)
```

*만약 `softwareupdate` 로 다운로드가 실패한다면(예: `PKDownloadError error 8`)  
- **네트워크 정책**(프록시, 방화벽) 확인  
- **오후 6시 이후**에 재시도 (많은 기업에서 이 시간대에 제한이 해제됩니다)  

---

## 4️⃣ MongoDB 설치 & 초기화

```bash
# Homebrew 로 MongoDB Community 설치
brew install mongodb-community@7.0

# 서비스 자동 시작 (macOS 재부팅 시 자동)
brew services start mongodb-community@7.0

# mongo 셸 접속 확인
mongosh
#   > db.version()
#   "7.x"
```

### 4‑1. `users`, `rooms`, `messages` 컬렉션 생성 (선택)

```javascript
// mongo 셸 안에서 실행
use gpt;
db.createCollection('users');
db.createCollection('rooms');
db.createCollection('messages');
```

### 4‑2. MongoDB Compass 설치 (GUI)

1. <https://www.mongodb.com/try/download/compass> 에서 macOS dmg 다운로드  
2. dmg 를 열어 `MongoDB Compass` 앱을 `/Applications` 로 드래그  
3. 실행 → `mongodb://127.0.0.1:27017` 입력 → `Connect` → `gpt` DB 확인  

---

## 5️⃣ Ollama 모델 구동 (다중 인스턴스)

```bash
# 20B 모델 3개
ollama serve --model llama2:20b   --port 11434 &
ollama serve --model mixtral:20b --port 11435 &
ollama serve --model phi:20b     --port 11436 &

# 120B 모델 2개
ollama serve --model llama2:120b --port 11437 &
ollama serve --model mixtral:120b --port 11438 &
```

*`&` 로 백그라운드 실행. `ps aux | grep ollama` 로 확인 가능.*  

> **Tip**: 모델을 `--model auto` 로 실행하면 해당 포트에 바인딩된 모델이 자동 선택됩니다.  

---

## 6️⃣ npm HTTPS “self‑signed certificate” 오류 해결 체크리스트

다음 단계 중 **필요한 부분만** 실행하면 `npx create-next-app@latest` 가 정상 동작합니다.

| 단계 | 명령 | 설명 |
|------|------|------|
| **① 임시 회피 (테스트용)** | `npm config set strict-ssl false`<br>`npx create-next-app@latest` | 성공하면 인증서 검증이 원인 |
| **② 원복** | `npm config set strict-ssl true` | 반드시 복구! |
| **③ 프록시·CA 설정** | ```bash<br>export HTTP_PROXY="http://proxy.mycorp.com:8080"<br>export HTTPS_PROXY="http://proxy.mycorp.com:8080"<br>export NODE_EXTRA_CA_CERTS=~/myproxy-ca.crt<br>``` | 프록시·자체 서명 CA 지정 |
| **④ macOS 키체인에 CA 등록** | 1️⃣ `myproxy-ca.crt` 파일을 다운로드 <br>2️⃣ **키체인 접근 → 시스템 → 인증서 → 파일 > 가져오기** <br>3️⃣ “항상 신뢰” 설정 | 시스템 전체에서 인증서 신뢰 |
| **⑤ npm 레지스트리 HTTP 강제** (보안 위험) | `npm config set registry http://registry.npmjs.org/` | HTTPS 차단 시 최후 수단 |
| **⑥ npm 캐시 정리 & 최신 버전 설치** | ```bash<br>npm cache clean --force<br>npm install -g npm@latest<br>brew reinstall node   # (Node 재설치)``` | 오래된 캐시·npm 버전 문제 해결 |
| **⑦ 대체 툴** | `yarn create next-app my-app` <br> `pnpm dlx create-next-app@latest my-app` | Yarn / pnpm 은 별도 레지스트리 캐시 사용 |

> **보안 권고**: ①‑② 임시 회피 후 반드시 `strict-ssl` 을 `true` 로 복구하고, 가능하면 ③‑④ 로 CA 를 시스템에 등록하세요.

---

## 7️⃣ 프로젝트 초기화 (Next.js)

```bash
# npm (또는 yarn/pnpm) 로 Next.js 프로젝트 생성
npx create-next-app@latest gpt   # 프로젝트 폴더명은 이미 존재하므로 생략 가능

# 이미 프로젝트 폴더가 있다면 의존성만 설치
cd gpt
npm install   # package.json 에 정의된 deps 설치
```

### 7‑1. `.env.local` 설정 (루트에 위치)

```dotenv
# gpt/.env.local
MONGODB_URI=mongodb://127.0.0.1:27017/gpt
JWT_SECRET=$(openssl rand -base64 32)   # 강력한 비밀키
# Ollama 인스턴스 리스트 (라운드 로빈)
OLLAMA_ENDPOINTS=http://localhost:11434,http://localhost:11435,http://localhost:11436,http://localhost:11437,http://localhost:11438
```

> **Tip**: `JWT_SECRET` 은 절대 Git에 커밋하지 말고, `git status` 로 확인 후 `.gitignore` 에 추가하세요.

---

## 8️⃣ 로컬 개발 서버 실행

```bash
npm run dev   # → http://localhost:3000
```

*다음 파일이 핵심*  

| 파일 | 역할 |
|------|------|
| `app/api/auth/register/route.js` | 회원가입 API |
| `app/api/auth/login/route.js` | 로그인 API (JWT 발급) |
| `app/api/generate/route.js` | Ollama 라운드‑로빈 요청 |
| `lib/ollama.js` | `getNextOllamaEndpoint()` 구현 |
| `app/login/page.js` / `app/signup/page.js` | 프론트엔드 폼 + 토큰 저장 |
| `app/page.js` (RoomsPanel) | 방 목록 UI |

---

## 9️⃣ 배포 (옵션)

- **Vercel** (가장 쉬운 방법)  
  1. GitHub 에 푸시 → Vercel 에 연결  
  2. Vercel 대시보드 → **Environment Variables** 에 `.env.local` 과 동일한 값 입력  
  3. 자동 빌드 (`npm run build`) 후 배포

> **주의**: Vercel 은 Docker 없이도 Node.js 런타임을 제공하므로 **Ollama 모델**은 **온‑프레미스 서버**에 그대로 유지하고, API 라우트에서 원격 Ollama 엔드포인트(`http://<mac‑ip>:11434`) 로 호출하도록 `OLLAMA_ENDPOINTS` 를 수정하면 됩니다.

---

## 🔧 흔히 마주치는 오류 & 해결법

| 증상 | 원인 | 해결 |
|------|------|------|
| `npm ERR! code EACCES` (mkdir `/usr/local/lib/node_modules/...`) | 전역 설치 권한 부족 | `npm config set prefix "${HOME}/.npm-global"` 후 PATH 추가 (위 5‑ 단계 참고) |
| `xcode-select: error: invalid developer directory` | Xcode CLI Tools 미설치/손상 | `sudo rm -rf /Library/Developer/CommandLineTools` → `xcode-select --install` |
| `Failed to pull docker image` | Docker 사용 불가 환경 | **무시** – Ollama 는 Docker 가 아닌 로컬 바이너리로 실행 |
| `self‑signed certificate in certificate chain` | 사내 프록시·CA | ① `npm config set strict-ssl false` → ② 프록시·CA 설정 (위 6‑ 단계) |
| `MongoDB connection refused` | MongoDB 서비스 미시작 | `brew services start mongodb-community@7.0` |

---

## 📌 마무리 체크리스트

1. **Homebrew, Xcode CLI, git, node** 설치 완료?  
2. **MongoDB** 서비스 실행 (`brew services start mongodb-community@7.0`)  
3. **Ollama** 모델 5개 각각 다른 포트에 실행 (`ollama serve … &`)  
4. **`.env.local`** 에 `MONGODB_URI`, `JWT_SECRET`, `OLLAMA_ENDPOINTS` 입력  
5. **npm SSL** 문제 해결 (필요 시 `strict-ssl false` → `true`)  
6. **프로젝트 의존성** `npm install` 완료  
7. **개발 서버** `npm run dev` 로 정상 구동 확인 (`http://localhost:3000`)  

> 모든 단계가 정상이라면, **30명 정도**의 동시 사용자(10 ~ 20 동시 요청) 를 M3 Ultra + 512 GB RAM 환경에서 충분히 처리할 수 있습니다.  

---  

**Happy coding! 🚀**

# GPT‑Chat (Ollama + Next.js + MongoDB)

**한눈에 보는 전체 흐름**  
Mac Studio (M3 Ultra + 512 GB RAM) ▶ Homebrew → Xcode CLI Tools → git → MongoDB & Compass → npm → Next.js 프로젝트 생성 → Ollama 모델 구동 → 앱 실행  

> **주의**: 이 환경은 **Docker를 사용할 수 없습니다**. 모든 의존성은 로컬에 직접 설치합니다.

---

## 📦 1️⃣ 모델을 **고정 포트·고정 모델** 로 실행하기

`ollama serve` 은 `--model` 플래그를 지원하지 않으므로 **두 가지 방법** 중 하나를 골라야 합니다.

| 방법 | 장점 | 실행 예시 |
|------|------|----------|
| **① runner (추천)**<br>Ollama 번들된 `runner` 바이너리를 직접 호출 | - 프로세스 시작 시 바로 모델이 메모리/GPU에 로드<br>- 첫 요청부터 **즉시** 응답 | ```bash<br># 20 B 모델 – 두 인스턴스<br>/Applications/Ollama.app/Contents/Resources/ollama runner \<br>  --model gpt-oss:20b \<br>  --port 11431 &<br>/Applications/Ollama.app/Contents/Resources/ollama runner \<br>  --model gpt-oss:20b \<br>  --port 11432 &<br># 120 B 모델 – 두 인스턴스<br>/Applications/Ollama.app/Contents/Resources/ollama runner \<br>  --model gpt-oss:120b \<br>  --port 11531 &<br>/Applications/Ollama.app/Contents/Resources/ollama runner \<br>  --model gpt-oss:120b \<br>  --port 11532 &<br>``` |
| **② serve + warm‑up** | - `ollama serve` 만 사용하면 CLI 가 더 간단<br>- 첫 요청이 조금 지연되지만 이후는 캐시된 모델 사용 | ```bash<br># 4개의 포트에 일반 서버만 띄우기<br>ollama serve --port 11431 &\nollama serve --port 11432 &\nollama serve --port 11531 &\nollama serve --port 11532 &\n\n# warm‑up (모델을 메모리로 로드) – 20 B\ncurl -s -X POST http://localhost:11431/api/generate \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"model\":\"gpt-oss:20b\",\"prompt\":\"warm‑up\",\"stream\":false}' > /dev/null\n# warm‑up – 120 B\ncurl -s -X POST http://localhost:11531/api/generate \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"model\":\"gpt-oss:120b\",\"prompt\":\"warm‑up\",\"stream\":false}' > /dev/null\n``` |

> **핵심** – 라운드‑로빈 로직은 `OLLAMA_ENDPOINTS` 에 **포트만** 넣으면 자동으로 순차 호출됩니다. `model` 은 API 요청 본문에 그대로 전달됩니다.

---

## 🛠️ 2️⃣ `.env.local` – 라운드‑로빈 엔드포인트 설정

```dotenv gpt/.env.local
MONGODB_URI=mongodb://127.0.0.1:27017/gpt
JWT_SECRET=$(openssl rand -base64 32)

# 라운드‑로빈에 포함될 4개의 고정 엔드포인트
# (포트 11434 은 테스트용이므로 여기 넣지 마세요)
OLLAMA_ENDPOINTS=http://localhost:11431,http://localhost:11432,http://localhost:11531,http://localhost:11532
```

> **주의**: `OLLAMA_ENDPOINTS` 에는 **포트만** 적고, 모델 이름은 `POST /api/generate` 의 `model` 필드에 넣습니다.

---

## 🚀 3️⃣ 자동 시작スクリプト – `scripts/start-ollama-instances.sh`

```bash gpt/scripts/start-ollama-instances.sh
#!/usr/bin/env bash
# --------------------------------------------------------------
# 1️⃣ 기존 Ollama 프로세스 정리 (우아하게 종료, 안되면 강제)
# --------------------------------------------------------------
pids=$(pgrep -f "ollama.*--port")
if [[ -n "$pids" ]]; then
  echo "Stopping old Ollama processes: $pids"
  kill -SIGINT $pids 2>/dev/null || true
  sleep 2
  kill -9 $pids 2>/dev/null || true
fi

# --------------------------------------------------------------
# 2️⃣ 20 B 모델 – 두 인스턴스 (runner)
# --------------------------------------------------------------
/Applications/Ollama.app/Contents/Resources/ollama runner \
  --model gpt-oss:20b \
  --port 11431 &
/Applications/Ollama.app/Contents/Resources/ollama runner \
  --model gpt-oss:20b \
  --port 11432 &

# --------------------------------------------------------------
# 3️⃣ 120 B 모델 – 두 인스턴스 (runner)
# --------------------------------------------------------------
/Applications/Ollama.app/Contents/Resources/ollama runner \
  --model gpt-oss:120b \
  --port 11531 &
/Applications/Ollama.app/Contents/Resources/ollama runner \
  --model gpt-oss:120b \
  --port 11532 &

# --------------------------------------------------------------
# 4️⃣ 확인 메시지
# --------------------------------------------------------------
echo "✅ All four dedicated Ollama instances are up."
echo "   → 11431, 11432  (20 B)"
echo "   → 11531, 11532  (120 B)"
```

### 사용 방법

```bash
# 파일에 실행 권한 부여 (한 번만 하면 됩니다)
chmod +x scripts/start-ollama-instances.sh

# 스크립트 실행
./scripts/start-ollama-instances.sh

# 실행 확인
ps aux | grep ollama | grep -E '11431|11432|11531|11532'




방법 ① runner (추천)

특징: Ollama에 포함된 runner 실행 파일을 직접 호출합니다.
장점: 프로세스가 시작될 때 모델이 바로 메모리·GPU에 로드되므로, 첫 요청부터 즉시 응답합니다.
실행 예시 (macOS 기준, 20 B 모델 두 인스턴스, 120 B 모델 두 인스턴스):
# 20 B 모델 – 두 인스턴스
/Applications/Ollama.app/Contents/Resources/ollama runner \
  --model gpt-oss:20b \
  --port 11431 &

/Applications/Ollama.app/Contents/Resources/ollama runner \
    --model gpt-oss:20b \
    --port 11431 \
    --ollama-engine &

/Applications/Ollama.app/Contents/Resources/ollama runner \
  --model gpt-oss:20b \
  --port 11432 &

# 120 B 모델 – 두 인스턴스
/Applications/Ollama.app/Contents/Resources/ollama runner \
  --model gpt-oss:120b \
  --port 11531 &

/Applications/Ollama.app/Contents/Resources/ollama runner \
  --model gpt-oss:120b \
  --port 11532 &
방법 ② serve + warm‑up

특징: ollama serve만 사용해 서버를 띄우고, 별도의 warm‑up 요청으로 모델을 메모리로 미리 로드합니다.
장점: CLI가 간단하고, serve만으로 여러 포트를 동시에 운영할 수 있습니다.
단점: 첫 요청 시 모델 로딩 때문에 약간 지연이 발생하지만, 이후 요청은 캐시된 모델을 사용하므로 빠릅니다.
실행 예시:
# 4개의 포트에 일반 서버만 띄우기
# ollama serve --port 11431 &
# ollama serve --port 11432 &
# ollama serve --port 11531 &
# ollama serve --port 11532 &

# 전부 다른 커맨드에서 띄워야함
OLLAMA_HOST=127.0.0.1:11435 ollama serve
OLLAMA_HOST=127.0.0.1:11436 ollama serve
OLLAMA_HOST=127.0.0.1:11437 ollama serve

OLLAMA_HOST=127.0.0.1:11531 ollama serve
OLLAMA_HOST=127.0.0.1:11532 ollama serve

# warm‑up (모델을 메모리로 로드) – 20 B * 3개
curl -s -X POST http://localhost:11435/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","prompt":"warm-up","stream":false}' > /dev/null

curl -s -X POST http://localhost:11436/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","prompt":"warm-up","stream":false}' > /dev/null

curl -s -X POST http://localhost:11437/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","prompt":"warm-up","stream":false}' > /dev/null


# warm‑up – 120 B * 2개
curl -s -X POST http://localhost:11531/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:120b","prompt":"warm-up","stream":false}' > /dev/null

  curl -s -X POST http://localhost:11532/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:120b","prompt":"warm-up","stream":false}' > /dev/null


  # GPT‑Chat (Ollama + Next.js + MongoDB)

**한눈에 보는 전체 흐름**  
Mac Studio (M3 Ultra + 512 GB RAM) ▶ Homebrew → Xcode CLI Tools → git → MongoDB & Compass → npm → Next.js 프로젝트 생성 → Ollama 모델 구동 → 앱 실행  

> **주의**: 이 환경은 **Docker를 사용할 수 없습니다**. 모든 의존성은 로컬에 직접 설치합니다.

---

## 1️⃣ 프로젝트 개요

| 파일/디렉터리 | 역할 |
|---------------|------|
| `app/api/auth/register/route.js` | 회원가입 (bcrypt 해시, MongoDB `users` 컬렉션) |
| `app/api/auth/login/route.js` | 로그인 (bcrypt 검증, JWT 발급) |
| `app/api/generate/route.js` | 프론트엔드 → Ollama 모델 요청 (라운드‑로빈) |
| `lib/mongo.js` | MongoDB 싱글톤 클라이언트 |
| `lib/ollama.js` | `OLLAMA_ENDPOINTS` 파싱·라운드‑로빈 헬퍼 |
| `app/login/page.js` / `app/signup/page.js` | 로그인·회원가입 UI + 토큰 로컬스토리지 저장 |
| `app/page.js` (RoomsPanel) | 방 목록 UI |
| `app/components/LoadingSpinner.js` | API 호출 시 로딩 오버레이 |
| `package.json` | 의존성·스크립트 정의 |
| `.env.local` | `MONGODB_URI`, `JWT_SECRET`, `OLLAMA_ENDPOINTS` 등 비밀값 |

> **핵심 로직** – `app/api/generate/route.js` 에서 `getNextOllamaEndpoint()` 로 **다중 Ollama 인스턴스**에 순차적으로 요청을 보냅니다. 별도 Nginx 등 프록시가 필요 없습니다.

---

## 2️⃣ 사전 준비 (Prerequisites)

| 항목 | 최소 버전 | 설치 명령 |
|------|-----------|-----------|
| **Homebrew** | 4.x | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |
| **Xcode Command Line Tools** | macOS 13 (Sequoia) 이상 | `softwareupdate --install-rosetta --agree-to-license` (자동 설치) |
| **git** | 2.51 | `brew install git` |
| **Node.js** | 18 LTS (추천) | `brew install node` |
| **MongoDB Community** | 7.x | `brew tap mongodb/brew && brew install mongodb-community@7.0` |
| **MongoDB Compass** (GUI) | 최신 | <https://www.mongodb.com/try/download/compass> 에서 dmg 다운로드 후 설치 |
| **Ollama** | 최신 | `brew install ollama` |

> **시간 제한**: 일부 기업 네트워크에서는 **오후 6시 이전**에 Xcode CLI Tools 다운로드가 차단될 수 있습니다. 이 경우 **오후 6시 이후**에 재시도하거나 사내 IT에 요청해 주세요.

---

## 3️⃣ Homebrew & Xcode CLI Tools 설치 상세

```bash
# 1️⃣ Homebrew 설치 (이미 설치돼 있으면 스킵)
#    비밀번호 입력 후 진행
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2️⃣ Xcode Command Line Tools 설치
#    프롬프트가 뜨면 <Enter> 를 눌러 진행
xcode-select --install

# 3️⃣ 설치 확인
brew --version          # → 4.x
git --version           # → 2.51.x
node -v                 # → v18.x (또는 최신 LTS)
```

*만약 `softwareupdate` 로 다운로드가 실패한다면*  

- **네트워크 정책**(프록시, 방화벽) 확인  
- **오후 6시 이후**에 재시도 (많은 기업에서 이 시간대에 제한이 해제됩니다)  

---

## 4️⃣ MongoDB 설치 & 초기화

```bash
# Homebrew 로 MongoDB Community 설치
brew install mongodb-community@7.0

# 서비스 자동 시작 (macOS 재부팅 시 자동)
brew services start mongodb-community@7.0

# mongo 셸 접속 확인
mongosh
#   > db.version()
#   "7.x"
```

### 4‑1. `users`, `rooms`, `messages` 컬렉션 생성 (선택)

```javascript
// mongo 셸 안에서 실행
use gpt;
db.createCollection('users');
db.createCollection('rooms');
db.createCollection('messages');
```

### 4‑2. MongoDB Compass 설치 (GUI)

1. <https://www.mongodb.com/try/download/compass> 에서 macOS dmg 다운로드  
2. dmg 를 열어 `MongoDB Compass` 앱을 `/Applications` 로 드래그  
3. 실행 → `mongodb://127.0.0.1:27017` 입력 → `Connect` → `gpt` DB 확인  

---

## 5️⃣ 현재 인스턴스 구성 및 사용법

### 5‑1️⃣ 라운드‑로빈을 위한 포트‑리스트 (.env.local)

```dotenv gpt/.env.local
MONGODB_URI=mongodb://127.0.0.1:27017/gpt
JWT_SECRET=$(openssl rand -base64 32)

# 5개의 Ollama 인스턴스 (포트만 적음)
# 라운드‑로빈 리스트 – 순서대로 순차 호출됩니다.
OLLAMA_ENDPOINTS=http://localhost:11435,http://localhost:11436,http://localhost:11437,http://localhost:11531,http://localhost:11532
```

> **핵심** – `OLLAMA_ENDPOINTS` 에 **포트만** 적고, 실제 모델 이름은 API 요청 본문(`model` 필드) 에 넣습니다.  
> **예시**: `model: "gpt-oss:20b"` 혹은 `model: "gpt-oss:120b"` 등 어떤 모델이든 전달 가능합니다.

### 5‑2️⃣ 5개의 Ollama 인스턴스 띄우기 (각 포트마다 별도 커맨드)

> **주의** – `OLLAMA_HOST` 를 지정한 뒤 `ollama serve` 를 실행해야 포트가 고정됩니다.  
> **백그라운드 실행** (`&`) 으로 여러 인스턴스를 동시에 띄울 수 있습니다.

```bash
# 1️⃣ 기존 Ollama 프로세스 정리 (옵션 – 스크립트 사용 시 자동 수행)
pids=$(pgrep -f "ollama.*--port")
if [[ -n "$pids" ]]; then
  kill -SIGINT $pids 2>/dev/null || true
  sleep 2
  kill -9 $pids 2>/dev/null || true
fi

# 2️⃣ 전부 다른 커맨드에서 포트를 지정해 서버 띄우기
OLLAMA_HOST=127.0.0.1:11435 ollama serve &
OLLAMA_HOST=127.0.0.1:11436 ollama serve &
OLLAMA_HOST=127.0.0.1:11437 ollama serve &
OLLAMA_HOST=127.0.0.1:11531 ollama serve &
OLLAMA_HOST=127.0.0.1:11532 ollama serve &
```

> **TIP** – macOS 에서는 위 명령을 터미널에 그대로 붙여넣고 `Enter` 하면 바로 백그라운드에서 5개의 서버가 기동됩니다.  
> **`ps aux | grep ollama`** 로 프로세스가 살아 있는지 확인하세요.

### 5‑3️⃣ Warm‑up (모델 미리 메모리/GPU 로드)

> **Warm‑up 은 선택 사항**이며, **한 번 실행한 뒤** 해당 포트에 **다른 모델**을 호출해도 전혀 문제 없습니다.  
> 실제 사용 시 **다른 모델을 같은 인스턴스에서 호출**하면 캐시된 모델이 이미 메모리에 있기에 응답 속도가 더 빨라집니다 – **오히려 장점**입니다.

```bash
# 20 B 모델을 3개의 포트에 warm‑up (한 번만 하면 메모리에 로드됩니다)
curl -s -X POST http://localhost:11435/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","prompt":"warm-up","stream":false}' > /dev/null

curl -s -X POST http://localhost:11436/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","prompt":"warm-up","stream":false}' > /dev/null

curl -s -X POST http://localhost:11437/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","prompt":"warm-up","stream":false}' > /dev/null

# 120 B 모델을 2개의 포트에 warm‑up
curl -s -X POST http://localhost:11531/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:120b","prompt":"warm-up","stream":false}' > /dev/null

curl -s -X POST http://localhost:11532/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:120b","prompt":"warm-up","stream":false}' > /dev/null
```

> **왜 warm‑up 이 필요하나요?**  
> `ollama serve` 로만 띄운 경우, 최초 요청 시 해당 모델을 디스크에서 메모리/GPU 로드하므로 **수 초 정도 지연**이 발생합니다.  
> 위 `curl` 명령을 한 번씩 수행하면 모델 파일이 미리 로드돼 **첫 사용자 요청부터 거의 0 ms**에 응답합니다.  

### 5‑4️⃣ 라운드‑로빈 확인

```bash
# 라운드‑로빈 리스트에 있는 모든 포트가 살아 있는지 확인
ps aux | grep ollama | grep -E '11435|11436|11437|11531|11532'
```

### 5‑5️⃣ 라운드‑로빈 동작 원리 (요약)

| 단계 | 동작 |
|------|------|
| **①** 프론트엔드(`app/page.js`)에서 모델 선택 → `selectedModel` 값이 `model` 필드에 포함돼 전송 |
| **②** `app/api/generate/route.js` → `getNextOllamaEndpoint()` 로 현재 라운드‑로빈 인덱스에 해당하는 **URL**을 얻음 (`http://localhost:11435` 등) |
| **③** 해당 포트에 **이미 메모리 / GPU**에 로드된 모델이 있으면 즉시 응답, 아니면 기존 캐시된 모델을 사용해도 정상 동작 |
| **④** 응답 스트림을 클라이언트에 전달 → UI에서 실시간 표시 |

> **핵심** – 인스턴스는 **특정 모델에 고정되지** 않습니다.  
> warm‑up 로드한 모델이 아니더라도 같은 포트에서 다른 모델을 요청하면 Ollama가 자동으로 해당 모델을 로드하고 처리합니다.  
> (따라서 warm‑up 은 “**이 포트에 최소 하나의 모델을 미리 메모리‑로드**” 하는 목적만 있으면 충분합니다.)

---

## 6️⃣ 자동 시작 스크립트 – `scripts/start-ollama-instances.sh`

```bash gpt/scripts/start-ollama-instances.sh
#!/usr/bin/env bash
# --------------------------------------------------------------
# 1️⃣ 기존 Ollama 프로세스 정리 (우아하게 종료, 안되면 강제)
# --------------------------------------------------------------
pids=$(pgrep -f "ollama.*--port")
if [[ -n "$pids" ]]; then
  echo "Stopping old Ollama processes: $pids"
  kill -SIGINT $pids 2>/dev/null || true
  sleep 2
  kill -9 $pids 2>/dev/null || true
fi

# --------------------------------------------------------------
# 2️⃣ 20B 모델 – 3개의 포트 (serve + warm‑up)
# --------------------------------------------------------------
OLLAMA_HOST=127.0.0.1:11435 ollama serve &
OLLAMA_HOST=127.0.0.1:11436 ollama serve &
OLLAMA_HOST=127.0.0.1:11437 ollama serve &

# --------------------------------------------------------------
# 3️⃣ 120B 모델 – 2개의 포트 (serve + warm‑up)
# --------------------------------------------------------------
OLLAMA_HOST=127.0.0.1:11531 ollama serve &
OLLAMA_HOST=127.0.0.1:11532 ollama serve &

# --------------------------------------------------------------
# 4️⃣ warm‑up (모델을 메모리·GPU에 미리 로드)
# --------------------------------------------------------------
sleep 2   # 서버가 완전히 기동될 때까지 잠시 대기

# 20 B 모델 * 3개
curl -s -X POST http://localhost:11435/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","prompt":"warm-up","stream":false}' > /dev/null
curl -s -X POST http://localhost:11436/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","prompt":"warm-up","stream":false}' > /dev/null
curl -s -X POST http://localhost:11437/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","prompt":"warm-up","stream":false}' > /dev/null

# 120 B 모델 * 2개
curl -s -X POST http://localhost:11531/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:120b","prompt":"warm-up","stream":false}' > /dev/null
curl -s -X POST http://localhost:11532/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:120b","prompt":"warm-up","stream":false}' > /dev/null

# --------------------------------------------------------------
# 5️⃣ 완료 메시지
# --------------------------------------------------------------
echo "✅ 5개의 Ollama 인스턴스가 라운드‑로빈으로 준비되었습니다."
echo "   포트: 11435, 11436, 11437 (20 B 모델)   11531, 11532 (120 B 모델)"
```

#### 사용 방법

```bash
# 스크립트에 실행 권한 부여 (한 번만 하면 됩니다)
chmod +x scripts/start-ollama-instances.sh

# 실행
./scripts/start-ollama-instances.sh

# 실행 확인 (5개의 프로세스가 살아 있는지 확인)
ps aux | grep ollama | grep -E '11435|11436|11437|11531|11532'
```

> **NOTE** – 인스턴스를 `runner` 로 띄우는 방법도 있지만, 현재 프로젝트에서는 **`ollama serve` + warm‑up** 방식을 사용했습니다.  
> `serve` 로 띄운 인스턴스는 **어떤 모델이든** 요청받아 처리할 수 있으므로, warm‑up 로드된 모델이 아니어도 같은 포트에서 다른 모델을 호출해도 전혀 문제 없습니다. 오히려 **다양한 모델을 동일 인스턴스에서 재사용** 할 수 있어 **리소스 활용도가 높아집니다**.

---

## 5️⃣ 프로젝트 초기화 (Next.js)

```bash
# 이미 프로젝트 폴더가 있다면 의존성만 설치
cd gpt
npm install   # package.json 에 정의된 deps 설치
```

### 5‑1. `.env.local` 설정 (루트에 위치)

```dotenv
# gpt/.env.local
MONGODB_URI=mongodb://127.0.0.1:27017/gpt
JWT_SECRET=$(openssl rand -base64 32)   # 강력한 비밀키

# Ollama 인스턴스 리스트 (라운드 로빈)
OLLAMA_ENDPOINTS=http://localhost:11435,http://localhost:11436,http://localhost:11437,http://localhost:11531,http://localhost:11532
```

> **Tip**: `JWT_SECRET` 은 절대 Git에 커밋하지 말고, `.gitignore` 에 추가하세요.

---

## 6️⃣ 로컬 개발 서버 실행

```bash
npm run dev   # → http://localhost:3000# SHGPT
# SHGPT
# SHGPT
# SHGPT
# SHGPT
# SHGPT
# SHGPT
