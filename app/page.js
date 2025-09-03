'use client';
import Image from "next/image";
import {
  useState,
  useRef,
  useEffect,
  memo,
  useCallback,
  useMemo,
} from "react";
import { useRouter } from 'next/navigation';
import MarkdownPreview from "@uiw/react-markdown-preview";
import rehypeSanitize from "rehype-sanitize";
import LoadingSpinner from './components/LoadingSpinner';
import { getModelOptions, getDefaultModel } from '@/lib/ollama';
import { Send, Plus, Edit, X, LogOut, MessageCircle, Settings, Loader2, Menu, ChevronLeft } from 'lucide-react';

/* ---------- 환경별 모델 옵션 (동적 로드) ---------- */
// 환경별 모델 옵션은 lib/ollama.js에서 관리됨
// 개발환경: gemma2:1b
// 실제환경: gpt-oss:20b, gpt-oss:120b

/* ---------- 입력창 (memo) ---------- */
const ChatInput = memo(function ChatInput({
  input,
  setInput,
  sendMessage,
  loading,
  handleKeyDown,
  selectedModel,
  setSelectedModel,
  modelOptions,
}) {
  return (
    <footer className="w-full max-w-4xl mx-auto p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
      <div className="relative">
        <textarea
          rows={3}
          className="input-primary w-full resize-none min-h-[48px] max-h-32 pr-32"
          placeholder="질문을 입력하세요… (Enter로 전송, Shift+Enter로 줄바꿈)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        
        {/* 우측 상단 컨트롤 영역 */}
        <div className="absolute top-2 right-2 flex items-center gap-2">
          {/* 모델 선택 드롭다운 */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={loading}
            className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded px-2 py-1 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {modelOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          
          {/* 전송 버튼 */}
          <button
            className={`
              p-2 rounded-md font-medium transition-all duration-200
              flex items-center justify-center min-w-[36px]
              ${loading
                ? "bg-gray-400 cursor-not-allowed"
                : input.trim().length > 0
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-300 hover:bg-gray-400 text-gray-600"}
            `}
            onClick={sendMessage}
            disabled={loading}
            aria-label="메시지 전송"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </footer>
  );
});

/* ---------- 마크다운 (memo) ---------- */
const SafeMarkdown = memo(function SafeMarkdown({ source }) {
  const plugins = useMemo(() => [rehypeSanitize], []);
  return (
    <div className="markdown-content">
      <MarkdownPreview
        source={source}
        style={{ padding: 0, backgroundColor: 'transparent' }}
        rehypePlugins={plugins}
      />
    </div>
  );
});


/* ---------- 사이드바 (방 리스트) ---------- */
function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  rooms,
  currentRoom,
  setCurrentRoom,
  addRoom,
  deleteRoom,
  renameRoom,
  userEmail,
  handleLogout,
  loading,
}) {
  const [editingRoom, setEditingRoom] = useState(null);
  const [editingName, setEditingName] = useState('');
  
  const startEditing = (room) => {
    setEditingRoom(room.id);
    setEditingName(room.name);
  };
  
  const saveEdit = () => {
    if (editingName.trim() && editingName.trim().length <= 15) {
      renameRoom(editingRoom, editingName.trim());
    }
    setEditingRoom(null);
    setEditingName('');
  };
  
  const cancelEdit = () => {
    setEditingRoom(null);
    setEditingName('');
  };

  const currentRoomName = rooms.find(r => r.id === currentRoom)?.name || '';
  return (
    <>
      {/* 접힌 사이드바 (아이콘만) */}
      <div 
        className={`
          fixed left-0 top-0 h-full w-16 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-40
          flex flex-col items-center py-4
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
          ${loading ? 'pointer-events-none opacity-50' : ''}
        `}
        onMouseEnter={() => !loading && setSidebarOpen(true)}
      >
        {/* 메뉴 버튼 */}
        <button
          className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-4"
          title="사이드바"
        >
          <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>

        {/* 채팅방 추가 */}
        {rooms.length < 10 && (
          <button
            onClick={() => !loading && addRoom()}
            className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-4"
            title="새 채팅방"
            disabled={loading}
          >
            <Plus className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        )}

        {/* 로그아웃 */}
        <button
          onClick={() => !loading && handleLogout()}
          className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mt-auto"
          title="로그아웃"
          disabled={loading}
        >
          <LogOut className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* 사이드바 오버레이 (모바일) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* 펼쳐진 사이드바 */}
      <div 
        className={`
          fixed left-0 top-0 h-full w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-50
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${loading ? 'pointer-events-none opacity-50' : ''}
        `}
        onMouseLeave={() => !loading && setSidebarOpen(false)}
      >
        {/* 사이드바 헤더 */}
        <div className="flex items-center justify-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">채팅방</h2>
        </div>

        {/* 현재 채팅방 정보 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-blue-600 rounded-full flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">현재 채팅방</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{currentRoomName}</p>
            </div>
          </div>
        </div>

        {/* 새 방 추가 버튼 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          {rooms.length < 10 && (
            <button
              className="btn-primary w-full flex items-center justify-center gap-2"
              onClick={() => !loading && addRoom()}
              disabled={loading}
            >
              <Plus className="h-4 w-4" />
              새 채팅방
            </button>
          )}
        </div>

        {/* 방 목록 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {rooms.map((room) => (
              <div
                key={room.id}
                className={`
                  group flex items-center justify-between p-3 rounded-lg
                  transition-all duration-200
                  ${room.id === currentRoom
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }
                  ${editingRoom === room.id ? "" : "cursor-pointer"}
                  ${loading ? "pointer-events-none opacity-50" : ""}
                `}
                onClick={() => {
                  if (!loading && editingRoom !== room.id) {
                    setCurrentRoom(room.id);
                  }
                }}
              >
                <div className="flex items-center min-w-0 flex-1">
                  <MessageCircle className="h-4 w-4 mr-3 flex-shrink-0" />
                  {editingRoom === room.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveEdit();
                        } else if (e.key === 'Escape') {
                          cancelEdit();
                        }
                      }}
                      onBlur={saveEdit}
                      className="flex-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded text-sm font-medium min-w-0"
                      maxLength={15}
                      autoFocus
                    />
                  ) : (
                    <span className="truncate font-medium">{room.name}</span>
                  )}
                </div>

                <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {editingRoom === room.id ? (
                    <>
                      <button
                        className="p-1.5 rounded-md transition-colors duration-200 text-green-600 hover:bg-green-100"
                        onClick={saveEdit}
                        aria-label="저장"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      <button
                        className="p-1.5 rounded-md transition-colors duration-200 text-red-600 hover:bg-red-100"
                        onClick={cancelEdit}
                        aria-label="취소"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      {/* 방 이름 편집 */}
                      <button
                        className={`
                          p-1.5 rounded-md transition-colors duration-200
                          ${room.id === currentRoom 
                            ? "text-white/80 hover:text-white hover:bg-white/20" 
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                          }
                        `}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!loading) startEditing(room);
                        }}
                        disabled={loading}
                        aria-label="방 이름 편집"
                      >
                        <Edit className="h-3 w-3" />
                      </button>

                      {/* 삭제 (최소 1개 방 보장) */}
                      {rooms.length > 1 && (
                        <button
                          className={`
                            p-1.5 rounded-md transition-colors duration-200
                            ${room.id === currentRoom 
                              ? "text-white/80 hover:text-white hover:bg-red-500/20" 
                              : "text-gray-500 hover:text-red-600 hover:bg-red-100"
                            }
                          `}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!loading && confirm(`"${room.name}" 방을 삭제하시겠습니까?`)) {
                              deleteRoom(room.id);
                            }
                          }}
                          disabled={loading}
                          aria-label="방 삭제"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 하단 사용자 정보 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">로그인 계정</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{userEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              className="ml-3 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="로그아웃"
            >
              <LogOut className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- 메인 컴포넌트 ---------- */
export default function Home() {
  const router = useRouter();

  /* ---------- 환경별 모델 옵션 초기화 ---------- */
  const [modelOptions, setModelOptions] = useState([]);
  const [isModelLoading, setIsModelLoading] = useState(true);

  /* ---------- 방·메시지 상태 ---------- */
  const [rooms, setRooms] = useState([]);               // [{id, name}]
  const [currentRoom, setCurrentRoom] = useState("");   // 현재 방 id
  const [messages, setMessages] = useState([]);         // 현재 방의 대화 내역
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const bottomRef = useRef(null);
  const assistantIdxRef = useRef(null);
  const abortControllerRef = useRef(null);

  // ---------- 환경별 모델 옵션 로드 ----------
  useEffect(() => {
    async function loadModelOptions() {
      try {
        const response = await fetch('/api/models');
        if (response.ok) {
          const data = await response.json();
          setModelOptions(data.models);
          setSelectedModel(data.defaultModel);
        } else {
          // API 실패 시 클라이언트 사이드에서 직접 로드
          const clientModelOptions = getModelOptions();
          const clientDefaultModel = getDefaultModel();
          setModelOptions(clientModelOptions);
          setSelectedModel(clientDefaultModel);
        }
      } catch (error) {
        console.error('모델 옵션 로드 실패:', error);
        // 에러 시 클라이언트 사이드 fallback
        const clientModelOptions = getModelOptions();
        const clientDefaultModel = getDefaultModel();
        setModelOptions(clientModelOptions);
        setSelectedModel(clientDefaultModel);
      } finally {
        setIsModelLoading(false);
      }
    }
    
    loadModelOptions();
  }, []);

  // ---------- 다크 모드 설정 ----------
  useEffect(() => {
    // 시스템 다크 모드 설정 감지 및 적용
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyDarkMode = (isDark) => {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    // 초기 설정
    applyDarkMode(mediaQuery.matches);

    // 다크 모드 변경 감지
    const handleChange = (e) => applyDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // ---------- 토큰 검증 및 사용자 정보 추출 ----------
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    
    // JWT 토큰에서 사용자 정보 추출
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.email) {
        setUserEmail(payload.email);
      }
    } catch (error) {
      console.error('토큰 파싱 실패:', error);
    }
  }, [router]);

  // ---------- 로그아웃 핸들러 ----------
  const handleLogout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  /* ---------- 1️⃣ 방 목록 복구 및 대화 기록 로드 ---------- */
  useEffect(() => {
    // 방 목록 복구
    const storedRooms = sessionStorage.getItem("chatRooms");
    let parsedRooms = [];
    if (storedRooms) {
      try {
        parsedRooms = JSON.parse(storedRooms);
      } catch (_) {}
    }

    if (parsedRooms.length === 0) {
      const defaultRoom = { id: `room-${Date.now()}`, name: "Chat" };
      parsedRooms = [defaultRoom];
    }
    
    setRooms(parsedRooms);
    const firstRoomId = parsedRooms[0].id;
    setCurrentRoom(firstRoomId);
    
    // 첫 번째 방의 대화 기록 로드
    const storedMessages = sessionStorage.getItem(`chatHistory_${firstRoomId}`);
    if (storedMessages) {
      try {
        setMessages(JSON.parse(storedMessages));
      } catch (_) {
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  }, []);

  /* ---------- 2️⃣ 방 변경 시 대화 기록 로드 ---------- */
  useEffect(() => {
    if (!currentRoom) return;
    
    const stored = sessionStorage.getItem(`chatHistory_${currentRoom}`);
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch (_) {
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  }, [currentRoom]);

  /* ---------- 3️⃣ 대화 기록 저장 ---------- */
  useEffect(() => {
    if (!currentRoom) return;
    sessionStorage.setItem(
      `chatHistory_${currentRoom}`,
      JSON.stringify(messages)
    );
  }, [messages, currentRoom]);

  /* ---------- 4️⃣ 방 목록 저장 ---------- */
  useEffect(() => {
    sessionStorage.setItem("chatRooms", JSON.stringify(rooms));
  }, [rooms]);

  /* ---------- 5️⃣ 자동 스크롤 ---------- */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---------- 방 관리 함수 ---------- */
  const addRoom = () => {
    if (rooms.length >= 10) return;
    const newId = `room-${Date.now()}`;
    const newRoom = { id: newId, name: "New Chat" };
    setRooms((prev) => [...prev, newRoom]);
    setCurrentRoom(newId);
  };

  const deleteRoom = (roomId) => {
    if (rooms.length <= 1) return;
    const newRooms = rooms.filter((r) => r.id !== roomId);
    setRooms(newRooms);
    sessionStorage.removeItem(`chatHistory_${roomId}`);

    if (roomId === currentRoom) {
      setCurrentRoom(newRooms[0].id);
    }
  };

  const renameRoom = (roomId, newName) => {
    const trimmed = newName.trim().slice(0, 8);
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, name: trimmed } : r))
    );
  };

  /* ---------- 스트리밍 전송 ---------- */
  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const userMsg = { role: "user", text: input.trim() };
    setInput("");
    setLoading(true);

    // ① user + placeholder assistant 삽입
    setMessages((prev) => {
      const newMsgs = [...prev, userMsg];
      const idx = newMsgs.length;
      newMsgs.push({ role: "assistant", text: "" });
      assistantIdxRef.current = idx;
      return newMsgs;
    });

    const recentContext = messages
      .slice(-3)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
      .join("\n");
    const fullPrompt = `${recentContext}\nUser: ${userMsg.text}\nAssistant:`;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          question: input,          // 질문 자체를 별도 필드로 전송
          prompt: fullPrompt,      // Ollama에 넘겨줄 전체 프롬프트
          stream: true,
          options: { temperature: 0.7, max_length: 500 },
          roomId: currentRoom,
        }),
        signal: controller.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          let parsed;
          try {
            parsed = JSON.parse(line);
          } catch {
            console.warn("JSON parse error:", line);
            continue;
          }

          if (parsed.response !== undefined) {
            setMessages((prev) => {
              const copy = [...prev];
              const idx = assistantIdxRef.current;
              copy[idx] = {
                role: "assistant",
                text: (copy[idx]?.text || "") + parsed.response,
              };
              return copy;
            });
          }
        }
      }

      // 남은 버퍼 처리
      if (buffer) {
        try {
          const last = JSON.parse(buffer);
          if (last.response) {
            setMessages((prev) => {
              const copy = [...prev];
              const idx = assistantIdxRef.current;
              copy[idx] = {
                role: "assistant",
                text: (copy[idx]?.text || "") + last.response,
              };
              return copy;
            });
          }
        } catch (_) {}
      }
    } catch (e) {
      if (e.name === "AbortError") {
        setMessages((prev) => {
          const copy = [...prev];
          const idx = assistantIdxRef.current;
          copy[idx] = {
            ...copy[idx],
            text: (copy[idx]?.text || "") + "\n⚡ 응답 중단",
          };
          return copy;
        });
      } else {
        setMessages((prev) => {
          const copy = [...prev];
          const idx = assistantIdxRef.current;
          copy[idx] = {
            role: "assistant",
            text: "❌ 요청 실패: " + (e?.message || "unknown error"),
          };
          return copy;
        });
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, messages, selectedModel]);

    /* ---------- 엔터키 전송 (Shift+Enter 은 줄바꿈) ---------- */
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey && !loading) {
        e.preventDefault();
        sendMessage();
      }
    },
    [loading, sendMessage]
  );

  /* ---------- 스트리밍 중단 ---------- */
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setLoading(false);
  }, []);

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 pl-16 relative">{/* LoadingSpinner 제거 - 입력 영역 오버레이로 대체 */}

      {/* 로딩 중 전체 화면 오버레이 */}
      {loading && (
        <div className="fixed inset-0 bg-transparent z-[100] cursor-not-allowed" 
             style={{ pointerEvents: 'auto' }}
             onClick={(e) => e.preventDefault()}
             onMouseDown={(e) => e.preventDefault()}
             onKeyDown={(e) => e.preventDefault()}
        />
      )}

      {/* Header – 로그아웃 버튼 + 타이틀 + 다크모드 토글 */}
      {/* 사이드바 */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        rooms={rooms}
        currentRoom={currentRoom}
        setCurrentRoom={setCurrentRoom}
        addRoom={addRoom}
        deleteRoom={deleteRoom}
        renameRoom={renameRoom}
        userEmail={userEmail}
        handleLogout={handleLogout}
        loading={loading}
      />

      <header className="w-full border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4 px-4 py-3">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">
            디지털서비스개발부 AI
          </h1>
        </div>
      </header>

      {/* 채팅 영역 – 개선된 메시지 레이아웃 */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 space-y-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <MessageCircle className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
              새로운 대화를 시작하세요
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              아래 입력창에 질문을 입력하면 AI가 답변해드립니다.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"} mb-4`}
            >
              {/* 메시지 내용 - 아이콘 제거, 너비 증가 */}
              <div className={`max-w-[95%] md:max-w-[90%] lg:max-w-[85%] xl:max-w-[80%] ${msg.role === "user" ? "chat-message-user" : "chat-message-assistant"}`}>
                <SafeMarkdown source={msg.text} />
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </main>

      {/* 모델 선택 및 입력 영역 - 하단 고정 */}
      <div className={`sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 ${loading ? 'relative' : ''}`}>
        {/* 로딩 중 오버레이 */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-30 flex items-center justify-center">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <span className="text-gray-600 dark:text-gray-400 text-sm">응답 생성 중...</span>
              <button
                onClick={stopStreaming}
                className="btn-danger flex items-center gap-1 text-xs py-1 px-2"
              >
                <X className="h-3 w-3" />
                중단
              </button>
            </div>
          </div>
        )}


        {/* Input area */}
        <ChatInput
          input={input}
          setInput={setInput}
          sendMessage={sendMessage}
          loading={loading}
          handleKeyDown={handleKeyDown}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          modelOptions={modelOptions}
        />
      </div>
    </div>
  );
}
