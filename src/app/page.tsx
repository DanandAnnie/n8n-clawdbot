"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  role: 'user' | 'bot';
  content: string;
  audio?: string; // base64 audio data URL
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Check for shared audio from Share Target API (e.g. shared from Voice Memos)
  const sharedHandled = useRef(false);
  useEffect(() => {
    if (sharedHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('shared') === 'audio') {
      sharedHandled.current = true;
      // Clean the URL
      window.history.replaceState({}, '', '/');
      // Retrieve the shared audio from the service worker cache
      caches.open('clawdbot-shared').then(cache =>
        cache.match('/shared-audio-file')
      ).then(response => response?.blob())
      .then(blob => {
        if (blob && blob.size > 0) {
          sendAudio(blob);
          // Clean up the cached file
          caches.open('clawdbot-shared').then(c => c.delete('/shared-audio-file'));
        }
      }).catch(() => {
        setError("Could not load the shared audio file.");
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendAudio = useCallback(async (audioBlob: Blob) => {
    setLoading(true);
    setError("");

    // Convert blob to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Audio = reader.result as string;

      const userMessage: Message = {
        role: 'user',
        content: '🎤 Voice message',
        audio: base64Audio,
      };
      setMessages(prev => [...prev, userMessage]);

      try {
        const response = await fetch("/api/workflow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Voice message",
            audio: base64Audio,
            audioType: audioBlob.type,
          }),
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
    reader.readAsDataURL(audioBlob);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        stream.getTracks().forEach(track => track.stop());
        sendAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      setError("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      // Stop all tracks
      const stream = mediaRecorderRef.current.stream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setRecordingTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      sendAudio(file);
    } else if (file) {
      setError("Please select an audio file.");
    }
    // Reset the input so the same file can be selected again
    e.target.value = '';
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

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
            <p className="text-slate-500 text-xs mt-3">
              Tap the mic to send a voice message, or attach an audio file.
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
              {msg.audio && (
                <audio controls src={msg.audio} className="mb-1.5 max-w-full" style={{ height: 36 }} />
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

      {/* Hidden file input for audio upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Input */}
      <div className="flex-shrink-0 bg-slate-800 border-t border-slate-700 px-4 py-3 safe-bottom">
        {isRecording ? (
          /* Recording UI */
          <div className="flex items-center gap-3">
            <button
              onClick={cancelRecording}
              className="w-10 h-10 rounded-full bg-slate-600 hover:bg-slate-500 flex items-center justify-center text-white transition-colors"
              title="Cancel recording"
            >
              {/* X icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="flex-1 flex items-center gap-3">
              <span className="recording-pulse w-3 h-3 rounded-full bg-red-500" />
              <span className="text-red-400 text-sm font-medium">Recording {formatTime(recordingTime)}</span>
            </div>
            <button
              onClick={stopRecording}
              className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-colors"
              title="Stop and send"
            >
              {/* Send/stop icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </button>
          </div>
        ) : (
          /* Normal input UI */
          <form onSubmit={handleSubmit} className="flex gap-2">
            {/* Attach audio file button */}
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="rounded-full w-10 h-10 p-0 bg-slate-700 hover:bg-slate-600 flex-shrink-0"
              title="Attach audio file"
            >
              {/* Paperclip icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </Button>
            <Input
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              placeholder="Type your message..."
              disabled={loading}
              className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 rounded-full px-4"
            />
            {currentInput.trim() ? (
              /* Send text button */
              <Button
                type="submit"
                disabled={loading}
                className="rounded-full w-10 h-10 p-0 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
              </Button>
            ) : (
              /* Record audio button */
              <Button
                type="button"
                onClick={startRecording}
                disabled={loading}
                className="rounded-full w-10 h-10 p-0 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
                title="Record voice message"
              >
                {/* Microphone icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                  <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
                </svg>
              </Button>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
