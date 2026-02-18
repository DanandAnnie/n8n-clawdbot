"use client";

import { useCallback } from "react";
import { Mic, Square, Play, Pause, Trash2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { AudioPlayer } from "@/components/AudioPlayer";

interface AudioRecorderProps {
  onSend: (audioBlob: Blob, mimeType: string, durationSeconds: number) => void;
  disabled?: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioRecorder({ onSend, disabled = false }: AudioRecorderProps) {
  const {
    state,
    duration,
    audioBlob,
    audioUrl,
    mimeType,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
  } = useAudioRecorder();

  const handleSend = useCallback(() => {
    if (audioBlob && mimeType) {
      onSend(audioBlob, mimeType, duration);
      resetRecording();
    }
  }, [audioBlob, mimeType, duration, onSend, resetRecording]);

  if (error) {
    return (
      <div className="flex items-center justify-between bg-red-900/30 rounded-xl px-4 py-3">
        <p className="text-red-300 text-sm flex-1">{error}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={resetRecording}
          className="text-red-300 hover:text-white h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // Idle state — show start button
  if (state === 'idle') {
    return (
      <div className="flex items-center justify-center bg-slate-700/50 rounded-xl px-4 py-3">
        <Button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          className="rounded-full bg-red-600 hover:bg-red-700 text-white px-6 gap-2"
        >
          <Mic className="w-4 h-4" />
          Start Recording
        </Button>
      </div>
    );
  }

  // Requesting permission
  if (state === 'requesting_permission') {
    return (
      <div className="flex items-center justify-center bg-slate-700/50 rounded-xl px-4 py-3">
        <p className="text-slate-300 text-sm">Requesting microphone access...</p>
      </div>
    );
  }

  // Recording state
  if (state === 'recording') {
    return (
      <div className="flex items-center gap-3 bg-slate-700/50 rounded-xl px-4 py-3">
        {/* Pulsing red dot + timer */}
        <div className="flex items-center gap-2 flex-1">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-sm font-mono">{formatDuration(duration)}</span>
          <span className="text-slate-400 text-xs">/ 2:00</span>
        </div>

        {/* Cancel button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={cancelRecording}
          className="text-slate-400 hover:text-white h-9 w-9"
        >
          <X className="w-5 h-5" />
        </Button>

        {/* Stop button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={stopRecording}
          className="text-white bg-red-600 hover:bg-red-700 rounded-full h-9 w-9"
        >
          <Square className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // Stopped state — preview and send
  if (state === 'stopped' && audioUrl) {
    return (
      <div className="flex flex-col gap-2 bg-slate-700/50 rounded-xl px-4 py-3">
        {/* Audio preview */}
        <AudioPlayer src={audioUrl} className="text-white" />

        {/* Actions */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-xs">{formatDuration(duration)}</span>
          <div className="flex gap-2">
            {/* Discard */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={resetRecording}
              className="text-slate-400 hover:text-red-400 h-9 w-9"
            >
              <Trash2 className="w-4 h-4" />
            </Button>

            {/* Send */}
            <Button
              type="button"
              onClick={handleSend}
              disabled={disabled}
              className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-4 gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
