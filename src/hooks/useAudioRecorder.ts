"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecorderState = 'idle' | 'requesting_permission' | 'recording' | 'stopped';

export interface UseAudioRecorderReturn {
  state: RecorderState;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  mimeType: string;
  error: string | null;
  isSupported: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  resetRecording: () => void;
}

const MAX_DURATION = 120; // 2 minutes

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);

  const isSupported = typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices !== 'undefined'
    && typeof MediaRecorder !== 'undefined';

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const revokeUrl = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  }, [audioUrl]);

  const resetRecording = useCallback(() => {
    revokeUrl();
    setAudioBlob(null);
    setError(null);
    setDuration(0);
    durationRef.current = 0;
    chunksRef.current = [];
    setState('idle');
  }, [revokeUrl]);

  const stopRecording = useCallback(() => {
    clearTimer();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    releaseStream();
  }, [clearTimer, releaseStream]);

  const cancelRecording = useCallback(() => {
    clearTimer();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Remove the onstop handler to prevent blob assembly
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }

    releaseStream();
    chunksRef.current = [];
    setAudioBlob(null);
    revokeUrl();
    setDuration(0);
    durationRef.current = 0;
    setState('idle');
  }, [clearTimer, releaseStream, revokeUrl]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('Audio recording is not supported in this browser');
      return;
    }

    // Clean up any previous state
    revokeUrl();
    setAudioBlob(null);
    setError(null);
    setDuration(0);
    durationRef.current = 0;
    chunksRef.current = [];

    const detectedMimeType = getSupportedMimeType();
    if (!detectedMimeType) {
      setError('No supported audio format found');
      return;
    }
    setMimeType(detectedMimeType);

    setState('requesting_permission');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: detectedMimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: detectedMimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState('stopped');
      };

      recorder.onerror = () => {
        setError('Recording failed');
        clearTimer();
        releaseStream();
        setState('idle');
      };

      recorder.start(1000); // 1-second timeslice
      setState('recording');

      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);

        if (durationRef.current >= MAX_DURATION) {
          stopRecording();
        }
      }, 1000);
    } catch (err) {
      releaseStream();
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your device settings.');
      } else {
        setError('Failed to start recording');
      }
      setState('idle');
    }
  }, [isSupported, revokeUrl, clearTimer, releaseStream, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      releaseStream();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
    };
  }, [clearTimer, releaseStream]);

  return {
    state,
    duration,
    audioBlob,
    audioUrl,
    mimeType,
    error,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
  };
}
