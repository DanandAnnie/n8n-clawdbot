"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

      if (data.status === "accepted") {
        // Async workflow, show thinking
        const thinkingMessage: Message = { role: 'bot', content: "Bot is thinking..." };
        setMessages(prev => [...prev, thinkingMessage]);
      } else {
        // Sync response
        const botContent = data.content || data.message || JSON.stringify(data);
        const botMessage: Message = { role: 'bot', content: botContent };
        setMessages(prev => [...prev, botMessage]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      const errorMessage: Message = { role: 'bot', content: "Sorry, an error occurred." };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 flex items-center justify-center">
      <Card className="w-full max-w-2xl h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle>ClawdBot</CardTitle>
          <CardDescription>Chat with your AI assistant</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto mb-4 space-y-2">
            {messages.map((msg, index) => (
              <div key={index} className={`p-3 rounded-lg max-w-xs ${msg.role === 'user' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted'}`}>
                <p className="text-sm">{msg.content}</p>
              </div>
            ))}
            {loading && (
              <div className="p-3 rounded-lg max-w-xs bg-muted">
                <p className="text-sm">Typing...</p>
              </div>
            )}
          </div>
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              placeholder="Type your message..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !currentInput.trim()}>
              Send
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
