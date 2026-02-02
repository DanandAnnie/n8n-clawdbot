"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  role: 'user' | 'bot';
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim()) return;

    const userMessage: Message = { role: 'user', content: currentInput };
    setMessages(prev => [...prev, userMessage]);
    setCurrentInput("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!response.ok) {
        throw new Error("Workflow request failed");
      }

      const data = await response.json();
      const botContent = data.content || data.message || JSON.stringify(data);
      const botMessage: Message = { role: 'bot', content: botContent };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      const errorMessage: Message = { role: 'bot', content: "Sorry, an error occurred." };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="fixed inset-0 flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-3 safe-top">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
            C
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-tight">ClawdBot</h1>
            <p className="text-slate-400 text-xs">AI Real Estate Tech Support</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl mb-4">
              C
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">Hey! Clod here.</h2>
            <p className="text-slate-400 text-sm max-w-sm">
              Your real estate tech support guru. Ask me about properties, automation, tech issues, or anything real estate related.
            </p>
          </div>
        )}
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`px-4 py-2.5 rounded-2xl max-w-[80%] ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-slate-700 text-slate-100 rounded-bl-sm'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-slate-700">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="px-4 py-2 bg-red-900/30 text-red-300 rounded-lg text-sm text-center">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-slate-800 border-t border-slate-700 px-4 py-3 safe-bottom">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 rounded-full px-4"
          />
          <Button
            type="submit"
            disabled={loading || !currentInput.trim()}
            className="rounded-full w-10 h-10 p-0 bg-blue-600 hover:bg-blue-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </Button>
        </form>
      </div>
    </main>
  );
}
