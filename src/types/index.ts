export type Message = {
  role: 'user' | 'bot';
  content: string;
  audioUrl?: string;
};

export type AudioPayload = {
  audio: string;      // base64-encoded audio data
  mimeType: string;
  duration: number;   // seconds
};

export type WorkflowResponse = {
  content?: string;
  message?: string;
  audioUrl?: string;
  transcription?: string;
};
