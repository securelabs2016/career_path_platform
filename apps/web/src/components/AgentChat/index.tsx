'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { IndustryData } from '@/lib/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
  provider?: string; // which AI answered this message
}

interface Props {
  data: IndustryData;
}

// ── Parse [role-id] citations into clickable links ────────────────────────────
function RichText({ text, data }: { text: string; data: IndustryData }) {
  const roleById = new Map(data.roles.map(r => [r.id, r]));
  // Match patterns like [am-r-21] or [semi-r-03]
  const parts = text.split(/(\[[a-z]+-r-\d+\])/g);

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[([a-z]+-r-\d+)\]$/);
        if (match) {
          const role = roleById.get(match[1]);
          return role ? (
            <Link
              key={i}
              href={`/${data.industry.slug}/role/${role.id}`}
              className="font-semibold text-blue-400 hover:text-blue-300 hover:underline"
              target="_blank"
            >
              {role.title}
            </Link>
          ) : (
            <span key={i} className="text-blue-400">{part}</span>
          );
        }
        // Render line breaks
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

const FALLBACK_MSG =
  'The AI advisor is not available right now. Make sure ANTHROPIC_API_KEY is set in your .env.local file and restart the dev server.';

export default function AgentChat({ data }: Props) {
  const [open,       setOpen]       = useState(false);
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [input,      setInput]      = useState('');
  const [streaming,  setStreaming]  = useState(false);
  const [suggested,  setSuggested]  = useState<string[]>([]);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const abortRef    = useRef<AbortController | null>(null);

  // Load suggested prompts
  useEffect(() => {
    fetch(`/api/agent/chat?industry=${data.industry.slug}`)
      .then(r => r.json())
      .then(d => setSuggested(d.suggested ?? []))
      .catch(() => {});
  }, [data.industry.slug]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;

    const userMsg: Message = {
      id:      Date.now().toString(),
      role:    'user',
      content: text.trim(),
    };
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '' };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setStreaming(true);

    abortRef.current = new AbortController();

    try {
      const history = messages.slice(-8).map(m => ({
        role:    m.role,
        content: m.content,
      }));

      const res = await fetch('/api/agent/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:  text.trim(),
          industry: data.industry.slug,
          history,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: FALLBACK_MSG }));
        const errorMsg = res.status === 429
          ? `⏱ ${body.error ?? 'Rate limit reached. Please wait before sending more messages.'}`
          : body.error ?? FALLBACK_MSG;
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: errorMsg, error: true } : m)
        );
        return;
      }

      // Read SSE stream
      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';
      let   currentProvider = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;

          const data_parsed = JSON.parse(payload);

          // Capture which provider answered
          if (data_parsed.provider) {
            currentProvider = data_parsed.provider;
            setMessages(prev =>
              prev.map(m => m.id === assistantId ? { ...m, provider: currentProvider } : m)
            );
          }

          if (data_parsed.done) break;
          if (data_parsed.error) {
            setMessages(prev =>
              prev.map(m => m.id === assistantId
                ? { ...m, content: data_parsed.error, error: true } : m)
            );
            break;
          }
          if (data_parsed.text) {
            setMessages(prev =>
              prev.map(m => m.id === assistantId
                ? { ...m, content: m.content + data_parsed.text } : m)
            );
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m => m.id === assistantId
            ? { ...m, content: FALLBACK_MSG, error: true } : m)
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, streaming, data.industry.slug]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
  };

  const showSuggested = messages.length === 0 && suggested.length > 0;

  return (
    <>
      {/* ── Floating toggle button ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close AI advisor' : 'Open AI career advisor'}
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3
                   rounded-2xl text-white font-semibold text-sm shadow-xl
                   hover:scale-105 active:scale-95 transition-transform duration-150
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        style={{ backgroundColor: data.industry.color }}
      >
        {open ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
        <span>AI Advisor</span>
        {!open && messages.length > 0 && (
          <span className="w-2 h-2 rounded-full bg-white/70" aria-hidden="true" />
        )}
      </button>

      {/* ── Chat panel ────────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed bottom-20 right-6 z-40 flex flex-col bg-gray-950 rounded-2xl
                     shadow-2xl border border-gray-800 overflow-hidden
                     w-[calc(100vw-3rem)] sm:w-96"
          style={{ height: 'min(580px, calc(100vh - 160px))' }}
          role="dialog"
          aria-label="AI Career Advisor"
          aria-modal="false"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ backgroundColor: `${data.industry.color}22`, borderBottom: `1px solid ${data.industry.color}33` }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" aria-hidden="true" />
              <span className="text-sm font-bold text-white">AI Career Advisor</span>
              <span className="text-xs text-gray-400">· {data.industry.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors
                             focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 rounded"
                  aria-label="Clear conversation"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 min-h-0">

            {/* Welcome message */}
            {messages.length === 0 && (
              <div className="text-center py-4">
                <p className="text-2xl mb-2" aria-hidden="true">🤖</p>
                <p className="text-sm font-semibold text-gray-200">
                  Ask me anything about {data.industry.name} careers
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  I know every role, salary range, and career pathway in this map
                </p>
              </div>
            )}

            {/* Suggested prompts */}
            {showSuggested && (
              <div className="flex flex-col gap-2">
                {suggested.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-left text-xs px-3 py-2.5 rounded-xl border border-gray-700
                               text-gray-300 hover:bg-gray-800 hover:border-gray-600 transition-colors
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Message bubbles */}
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={[
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : msg.error
                      ? 'bg-red-950 text-red-300 border border-red-800 rounded-bl-sm'
                      : 'bg-gray-800 text-gray-100 rounded-bl-sm',
                  ].join(' ')}
                  style={msg.role === 'user' ? { backgroundColor: data.industry.color } : {}}
                >
                  {msg.role === 'assistant' && !msg.error ? (
                    <>
                      <RichText text={msg.content || '…'} data={data} />
                      {/* Provider badge — tiny, subtle */}
                      {msg.provider && msg.content && (
                        <span className="block text-[9px] text-gray-600 mt-1.5 select-none">
                          via {msg.provider}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content || '…'}</span>
                  )}

                  {/* Streaming cursor */}
                  {msg.role === 'assistant' && streaming && !msg.error &&
                   msg.content === messages[messages.length - 1]?.content && (
                    <span className="inline-block w-0.5 h-3.5 bg-gray-400 ml-0.5 animate-pulse align-text-bottom"
                      aria-hidden="true" />
                  )}
                </div>
              </div>
            ))}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <form
            onSubmit={handleSubmit}
            className="flex-shrink-0 px-3 py-3 border-t border-gray-800 bg-gray-900 flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about careers, skills, salaries…"
              rows={1}
              disabled={streaming}
              className="flex-1 resize-none bg-gray-800 border border-gray-700 rounded-xl
                         px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500
                         focus:outline-none focus:border-gray-500
                         disabled:opacity-50 max-h-32 overflow-y-auto"
              style={{ lineHeight: '1.4' }}
              aria-label="Message to AI advisor"
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
                         text-white transition-opacity disabled:opacity-40
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              style={{ backgroundColor: data.industry.color }}
              aria-label="Send message"
            >
              {streaming ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center text-[10px] text-gray-600 py-1.5 bg-gray-900 flex-shrink-0">
            Powered by Claude · Role citations link to the career map
          </p>
        </div>
      )}
    </>
  );
}
