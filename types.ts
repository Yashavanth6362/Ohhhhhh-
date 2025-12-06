export interface AudioBlob {
  data: string;
  mimeType: string;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface Transcription {
  text: string;
  isUser: boolean;
  timestamp: number;
}

export interface VoiceConfig {
  prebuiltVoiceConfig: {
    voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  };
}