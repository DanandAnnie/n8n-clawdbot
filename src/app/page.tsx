"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AudioRecorder } from "@/components/AudioRecorder";
import { AudioPlayer } from "@/components/AudioPlayer";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
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
      const botMessage: Message = {
        role: 'bot',
        content: botContent,
        audioUrl: data.audioUrl,
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      const errorMessage: Message = { role: 'bot', content: "Sorry, an error occurred." };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleAudioSend = useCallback(async (audioBlob: Blob, mimeType: string, durationSeconds: number) => {
    const base64 = await blobToBase64(audioBlob);

    const userMessage: Message = {
      role: 'user',
      content: `Voice message - ${formatDuration(durationSeconds)}`,
    };
    setMessages(prev => [...prev, userMessage]);
    setShowAudioRecorder(false);
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/workflow/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: base64,
          mimeType,
          duration: durationSeconds,
        }),
      });

      if (!response.ok) {
        throw new Error("Audio upload failed");
      }

      const data = await response.json();

      // Update user message with audio URL and transcription from n8n
      if (data.audioUrl || data.transcription) {
        setMessages(prev => {
          const updated = [...prev];
          // Find the voice message we just added
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i] === userMessage) {
              updated[i] = {
                ...updated[i],
                audioUrl: data.audioUrl || updated[i].audioUrl,
                content: data.transcription || updated[i].content,
              };
              break;
            }
          }
          return updated;
        });
      }

      // Add bot response
      const botContent = data.content || data.message || JSON.stringify(data);
      const botMessage: Message = {
        role: 'bot',
        content: botContent,
        audioUrl: data.botAudioUrl,
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audio upload failed");
      const errorMessage: Message = { role: 'bot', content: "Sorry, an error occurred processing your audio." };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, []);

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
              {msg.audioUrl && (
                <div className="mb-2">
                  <AudioPlayer src={msg.audioUrl} />
                </div>
              )}
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
        {/* Audio Recorder Panel */}
        {showAudioRecorder && (
          <div className="mb-3">
            <AudioRecorder onSend={handleAudioSend} disabled={loading} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          {/* Mic toggle */}
          <Button
            type="button"
            onClick={() => setShowAudioRecorder(prev => !prev)}
            disabled={loading}
            variant="ghost"
            className={cn(
              "rounded-full w-10 h-10 p-0 flex-shrink-0",
              showAudioRecorder
                ? "text-red-400 bg-red-900/30 hover:bg-red-900/50 hover:text-red-300"
                : "text-slate-400 hover:text-white hover:bg-slate-700"
            )}
          >
            <Mic className="w-5 h-5" />
          </Button>

          <Input
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading || showAudioRecorder}
            className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 rounded-full px-4"
          />
          <Button
            type="submit"
            disabled={loading || !currentInput.trim() || showAudioRecorder}
            className="rounded-full w-10 h-10 p-0 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </main>
  );
}
