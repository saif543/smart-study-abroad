'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface AIChatProps {
  systemMessages: string[];
}

export default function AIChat({ systemMessages }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add system messages from parent
  useEffect(() => {
    if (systemMessages.length > 0) {
      const lastMessage = systemMessages[systemMessages.length - 1];
      setMessages(prev => {
        const existingTexts = prev.map(m => m.text);
        if (!existingTexts.includes(lastMessage)) {
          return [...prev, {
            id: Date.now().toString(),
            text: lastMessage,
            sender: 'ai' as const,
            timestamp: new Date(),
          }];
        }
        return prev;
      });
    }
  }, [systemMessages]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: data.response || 'Sorry, I could not process that.',
        sender: 'ai',
        timestamp: new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, there was an error. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed bottom-6 right-6 z-40 transition-all duration-500 ${
      isExpanded ? 'w-[420px] h-[600px]' : 'w-auto h-auto'
    }`}>
      {/* Chat Window */}
      {isExpanded && (
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col h-full scale-in overflow-hidden">
          {/* Header */}
          <div className="relative bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 p-5">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🤖</span>
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">AI Assistant</h3>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <p className="text-white/80 text-sm">Online & Ready to Help</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-slate-50 to-white">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                  <span className="text-4xl">👋</span>
                </div>
                <h4 className="font-bold text-slate-800 text-lg mb-2">Welcome!</h4>
                <p className="text-slate-500 mb-6">I can help you with:</p>
                <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                  {[
                    { icon: '🏛️', text: 'Finding universities' },
                    { icon: '📋', text: 'Admission requirements' },
                    { icon: '📅', text: 'Application deadlines' },
                    { icon: '🎓', text: 'Scholarships info' },
                  ].map((item, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
                      <span className="text-xl block mb-1">{item.icon}</span>
                      <span className="text-xs text-slate-600">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm mr-2 flex-shrink-0 shadow-md">
                    🤖
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-br-md'
                      : 'bg-white border border-slate-100 text-slate-800 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  <p className={`text-xs mt-2 ${
                    msg.sender === 'user' ? 'text-white/60' : 'text-slate-400'
                  }`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-sm ml-2 flex-shrink-0 shadow-md">
                    👤
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm mr-2 flex-shrink-0">
                  🤖
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-md px-5 py-4 shadow-sm">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2.5 h-2.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-100 bg-white">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Ask me anything..."
                className="flex-1 px-5 py-3.5 rounded-2xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none text-sm text-slate-800 placeholder:text-slate-400"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs text-slate-400 mt-3">
              Powered by AI • Ask about universities, requirements & more
            </p>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="group relative bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 p-4 rounded-2xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-110 transition-all flex items-center justify-center"
        >
          {/* Pulse animation */}
          <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 animate-ping opacity-20" />

          <span className="text-2xl relative">🤖</span>

          {/* Tooltip */}
          <span className="absolute right-full mr-3 px-3 py-2 rounded-xl bg-slate-800 text-white text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Chat with AI Assistant
          </span>
        </button>
      )}
    </div>
  );
}
