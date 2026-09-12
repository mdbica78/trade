'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type FormEvent, useMemo, useState } from 'react';

type ChatRole = 'user' | 'assistant' | 'system';

type UIMessage = {
  id: string;
  role: ChatRole;
  content: string;
  success?: boolean;
  intent?: string;
  data?: Record<string, unknown>;
};

type AIResponsePayload = {
  provider: string;
  success: boolean;
  message: string;
  model?: string;
  intent?: string;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
  data?: Record<string, unknown>;
};

type PendingConfirmation = {
  token: string;
  intent?: string;
  message: string;
  data?: Record<string, unknown>;
};

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseResponsePayload(value: unknown): AIResponsePayload | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.provider !== 'string' ||
    typeof value.success !== 'boolean' ||
    typeof value.message !== 'string'
  ) {
    return null;
  }

  return {
    provider: value.provider,
    success: value.success,
    message: value.message,
    model: typeof value.model === 'string' ? value.model : undefined,
    intent: typeof value.intent === 'string' ? value.intent : undefined,
    requiresConfirmation: value.requiresConfirmation === true,
    confirmationToken:
      typeof value.confirmationToken === 'string' ? value.confirmationToken : undefined,
    data: isRecord(value.data) ? value.data : undefined,
  };
}

function prettyAction(intent: string | undefined): string {
  if (!intent) {
    return 'Action';
  }

  return intent.replace(/_/g, ' ');
}

export default function AIChatPage() {
  const pathname = usePathname();
  const [messages, setMessages] = useState<UIMessage[]>([
    {
      id: createId(),
      role: 'assistant',
      content:
        'AI assistant ready. Ask me to show configuration, add/remove ETFs or metrics, or set dashboard metric.',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  const sendMessage = async (
    prompt: string,
    confirmation?: { confirm: true; confirmationToken: string },
  ): Promise<void> => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || sending) {
      return;
    }

    setSending(true);
    setError(null);

    const userMessage: UIMessage = {
      id: createId(),
      role: 'user',
      content: trimmedPrompt,
    };
    const assistantMessageId = createId();
    const baseMessages = [...messages, userMessage];
    const payloadMessages = baseMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages([
      ...baseMessages,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
      },
    ]);
    setInput('');

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          messages: payloadMessages,
          confirm: confirmation?.confirm === true,
          confirmationToken: confirmation?.confirmationToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI request failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('AI response stream is unavailable');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let streamedText = '';
      const finalPayloadRef: { value: AIResponsePayload | null } = { value: null };

      const processLine = (line: string) => {
        if (!line.trim()) {
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(line) as unknown;
        } catch {
          return;
        }

        if (!isRecord(parsed) || typeof parsed.type !== 'string') {
          return;
        }

        if (parsed.type === 'token' && typeof parsed.text === 'string') {
          streamedText += parsed.text;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessageId ? { ...message, content: streamedText } : message,
            ),
          );
          return;
        }

        if (parsed.type === 'final') {
          finalPayloadRef.value = parseResponsePayload(parsed.response);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let newLineIndex = buffer.indexOf('\n');
        while (newLineIndex >= 0) {
          const line = buffer.slice(0, newLineIndex);
          buffer = buffer.slice(newLineIndex + 1);
          processLine(line);
          newLineIndex = buffer.indexOf('\n');
        }
      }

      const trailing = buffer + decoder.decode();
      if (trailing.trim().length > 0) {
        processLine(trailing.trim());
      }

      const finalPayload = finalPayloadRef.value;
      if (!finalPayload) {
        throw new Error('AI stream did not provide a final response payload');
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                content: finalPayload.message || streamedText,
                success: finalPayload.success,
                intent: finalPayload.intent,
                data: finalPayload.data,
              }
            : message,
        ),
      );

      if (finalPayload.requiresConfirmation && finalPayload.confirmationToken) {
        setPendingConfirmation({
          token: finalPayload.confirmationToken,
          intent: finalPayload.intent,
          message: finalPayload.message,
          data: finalPayload.data,
        });
      } else {
        setPendingConfirmation(null);
      }
    } catch (streamError: unknown) {
      const message = streamError instanceof Error ? streamError.message : 'Unknown error';
      setError(`Failed to process AI request: ${message}`);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessageId
            ? {
                ...item,
                content: 'Failed to process request.',
                success: false,
              }
            : item,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage(input);
  };

  const confirmPending = async () => {
    if (!pendingConfirmation) {
      return;
    }

    await sendMessage('confirm', {
      confirm: true,
      confirmationToken: pendingConfirmation.token,
    });
  };

  const cancelPending = () => {
    if (!pendingConfirmation) {
      return;
    }

    setPendingConfirmation(null);
    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: 'assistant',
        content: 'Pending configuration change canceled.',
      },
    ]);
  };

  return (
    <main className="min-h-screen bg-white">
      <nav className="bg-[#0b3a6e] px-6 py-4 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            ETF Monitor
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/"
              className={pathname === '/' ? 'font-semibold underline' : 'text-blue-100 hover:text-white'}
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className={pathname.startsWith('/settings') ? 'font-semibold underline' : 'text-blue-100 hover:text-white'}
            >
              Settings
            </Link>
            <Link
              href="/ai/chat"
              className={pathname.startsWith('/ai') ? 'font-semibold underline' : 'text-blue-100 hover:text-white'}
            >
              AI Assistant
            </Link>
          </div>
        </div>
      </nav>

      <header className="bg-[#0b3a6e] px-6 py-5 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-semibold tracking-tight">AI Configuration Assistant</h1>
          <p className="mt-1 text-sm text-blue-100">
            Configuration changes are proposed first and only persisted after explicit confirmation.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-700">
              Ask about configuration or request add/remove actions for ETFs and metrics.
            </p>
            <Link href="/settings/ai" className="text-sm font-medium text-[#0b3a6e] hover:underline">
              AI Settings
            </Link>
          </div>

          <div className="max-h-[420px] space-y-3 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'ml-auto max-w-[85%] bg-[#0b3a6e] text-white'
                    : 'mr-auto max-w-[85%] bg-white text-slate-900'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content || (sending ? '...' : '')}</p>
                {message.intent ? (
                  <p className="mt-1 text-xs opacity-70">
                    {prettyAction(message.intent)}
                    {typeof message.success === 'boolean'
                      ? message.success
                        ? ' · success'
                        : ' · failed'
                      : ''}
                  </p>
                ) : null}
                {message.data ? (
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-2 text-xs text-slate-700">
                    {JSON.stringify(message.data, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>

          {pendingConfirmation ? (
            <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                Pending {prettyAction(pendingConfirmation.intent)} confirmation
              </p>
              <p className="mt-1 text-sm text-amber-800">{pendingConfirmation.message}</p>
              {pendingConfirmation.data ? (
                <pre className="mt-2 overflow-x-auto rounded bg-amber-100 p-2 text-xs text-amber-900">
                  {JSON.stringify(pendingConfirmation.data, null, 2)}
                </pre>
              ) : null}
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={confirmPending}
                  disabled={sending}
                  className="rounded bg-[#0b3a6e] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a335f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? 'Confirming...' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={cancelPending}
                  disabled={sending}
                  className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

          <form onSubmit={onSubmit} className="mt-4 flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder='Try: "add etf TVBETETF" or "show configuration"'
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm outline-none ring-[#0b3a6e] focus:ring-2"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!canSend}
              className="rounded bg-[#0b3a6e] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a335f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
