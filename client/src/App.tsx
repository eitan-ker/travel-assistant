import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useChat } from './hooks/useChat';
import './App.css';

const COT_TOOLS = new Set(['explore_destination', 'explore_attractions', 'explore_trip', 'think_packing_advice']);
function isCotTool(tool: string): boolean {
  return COT_TOOLS.has(tool) || tool.startsWith('think_');
}

export default function App() {
  const { messages, loading, send, clear, userContext } = useChat();
  const hasProfile = Object.values(userContext).some((v) => v && (Array.isArray(v) ? v.length > 0 : true));
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

      {hasProfile && (
        <div className="profile-bar">
          <span className="profile-label">Traveler profile:</span>
          {userContext.destination && <span className="profile-tag">✈ {userContext.destination}</span>}
          {userContext.origin && <span className="profile-tag">from {userContext.origin}</span>}
          {userContext.passport?.map((p) => <span key={p} className="profile-tag">🛂 {p}</span>)}
          {userContext.tripDuration && <span className="profile-tag">{userContext.tripDuration}</span>}
          {userContext.budget && <span className="profile-tag">{userContext.budget}</span>}
          {userContext.travelGroup && <span className="profile-tag">{userContext.travelGroup}</span>}
          {userContext.interests?.map((i) => <span key={i} className="profile-tag">{i}</span>)}
          {userContext.travelStyle && <span className="profile-tag">{userContext.travelStyle}</span>}
          {userContext.travelerConstraints && <span className="profile-tag">⚠ {userContext.travelerConstraints}</span>}
        </div>
      )}

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
          <div key={msg.id} className={`message ${msg.role}${msg.error ? ' error' : ''}${msg.isClarification ? ' clarification' : ''}`}>
            <div className="message-body">
              <div className="bubble">
                {msg.role === 'assistant'
                  ? <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
                  : msg.content}
              </div>
              {msg.role === 'assistant' && msg.thinkingSeconds !== undefined && !msg.error && (
                <div className="thinking-time">thought for {msg.thinkingSeconds}s</div>
              )}
            {msg.role === 'assistant' && !msg.error && (
                <div className="message-meta">
                  <div className="sources">
                    {msg.sources?.map((s) => (
                      <span key={s} className="source-tag">{s}</span>
                    ))}
                  </div>
                  {msg.toolsUsed?.filter(t => !isCotTool(t)).length > 0 && (
                    <div className="sources">
                      {msg.toolsUsed!.filter(t => !isCotTool(t)).map((t) => (
                        <span key={t} className="tool-tag">{t.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  )}
                  {msg.toolsUsed?.filter(t => isCotTool(t)).length > 0 && (
                    <div className="sources">
                      {msg.toolsUsed!.filter(t => isCotTool(t)).map((t) => (
                        <span key={t} className="cot-tag">{t.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  )}
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
