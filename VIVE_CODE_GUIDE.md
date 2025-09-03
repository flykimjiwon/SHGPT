# VIVE CODE GUIDE

Claude Code에서 이전 버전으로 롤백하는 방법은 여러 가지가 있습니다:

## **1. ccundo 사용 (추천) - 가장 간편**

ccundo는 Claude Code의 세션 파일을 읽어서 개별 작업을 선택적으로 되돌릴 수 있는 도구입니다.

**설치:**
```bash
npm install -g ccundo
```

**사용법:**
```bash
# 최근 작업 목록 확인
ccundo list

# 변경 사항 미리보기
ccundo preview

# 롤백 실행
ccundo undo

# 특정 작업 ID로 롤백
ccundo undo <operation-id>
```

## **2. Claude Code 내장 기능**

**Escape 키 활용:**
- Escape 키로 Claude 작업을 중단
- 더블 탭 Escape으로 히스토리에서 이전 프롬프트로 이동해서 편집 가능

**Claude에게 직접 요청:**
```bash
claude "방금 변경사항을 이전 상태로 되돌려줘"
claude "마지막 작업 이전 버전으로 복원해줘"
```

## **3. Git과 함께 사용 (가장 안전)**

프롬프트 사이사이에 git에 커밋하여 언제든 직접 되돌릴 수 있습니다.

```bash
# Claude 작업 전 커밋
git add .
git commit -m "before claude changes"

# 문제 발생 시 롤백
git reset --hard HEAD~1
```

## **4. 파일 백업 활용**

```bash
# 중요한 파일은 미리 백업
cp important_file.js important_file.js.backup

# 복원
mv important_file.js.backup important_file.js
```

## **실용적인 워크플로우:**

1. **ccundo 설치** (한 번만)
2. **작업 전 git 커밋** 습관화
3. **문제 발생 시 ccundo로 빠른 롤백**
4. **복잡한 경우 git reset 활용**

ccundo는 카스케이딩 안전 기능이 있어서 선택한 작업과 그 이후의 모든 작업을 함께 되돌려 프로젝트 일관성을 유지합니다.

**ccundo**가 가장 편리하고 안전한 방법입니다!