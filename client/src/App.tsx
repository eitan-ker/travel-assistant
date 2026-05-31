import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from './hooks/useChat';
import './App.css';

export default function App() {
  const { messages, loading, send, clear } = useChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    send(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title">
          <span>✈</span>
          <h1>Travel Assistant</h1>
        </div>
        <button className="clear-btn" onClick={clear} disabled={loading}>
          New Chat
        </button>
      </header>

      <main className="chat-area">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>Ask me anything about travel — destinations, packing, local tips, weather, and more.</p>
            <div className="suggestions">
              {[
                'Where should I go in Southeast Asia on a budget?',
                'What to pack for a week in Iceland in winter?',
                'Best local food spots in Tokyo?',
              ].map((s) => (
                <button key={s} className="suggestion" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}${msg.error ? ' error' : ''}`}>
            <div className="message-body">
              <div className="bubble">
                {msg.role === 'assistant'
                  ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                  : msg.content}
              </div>
              {msg.role === 'assistant' && !msg.error && (
                <div className="message-meta">
                  <div className="sources">
                    {msg.sources?.map((s) => (
                      <span key={s} className="source-tag">{s}</span>
                    ))}
                    {msg.toolsUsed?.map((t) => (
                      <span key={t} className={t.startsWith('think_') ? 'cot-tag' : 'tool-tag'}>
                        {t.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                  {msg.supervisors && msg.supervisors.length > 0 && (
                    <div className="supervisor-list">
                      {msg.supervisors.map((s) => (
                        <div key={s.name} className={`supervisor-row ${s.verdict.toLowerCase()}`}>
                          <span className="supervisor-name">{s.name}</span>
                          <span className="supervisor-verdict">{s.verdict}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message assistant">
            <div className="bubble typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      <footer className="input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about destinations, packing, weather, local tips..."
          rows={1}
          disabled={loading}
        />
        <button onClick={handleSend} disabled={!input.trim() || loading}>
          Send
        </button>
      </footer>
    </div>
  );
}
