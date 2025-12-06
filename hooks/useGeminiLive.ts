import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decodeBase64, decodeAudioData } from '../utils/audioUtils';
import { ConnectionState, Transcription, VoiceConfig } from '../types';

interface UseGeminiLiveProps {
  initialVoice?: string;
  systemInstruction?: string;
}

export const useGeminiLive = ({ 
  initialVoice = 'Zephyr',
  systemInstruction = 'You are a helpful, conversational AI assistant.' 
}: UseGeminiLiveProps = {}) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [transcripts, setTranscripts] = useState<Transcription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  
  // Refs for audio contexts and processing
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Transcripts buffering
  const currentInputTransRef = useRef<string>('');
  const currentOutputTransRef = useRef<string>('');

  const disconnect = useCallback(async () => {
    setConnectionState(ConnectionState.DISCONNECTED);
    
    // Cleanup audio resources
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (inputAudioContextRef.current) {
      await inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    
    if (outputAudioContextRef.current) {
      // Stop all playing sources
      audioSourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
      });
      audioSourcesRef.current.clear();
      
      await outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    // Note: session.close() is called implicitly when we drop the reference 
    // or when the component unmounts usually, but the SDK doesn't expose a clean 
    // 'close' method on the promise itself. We reset the promise ref.
    sessionPromiseRef.current = null;
    nextStartTimeRef.current = 0;
    setAnalyser(null);
  }, []);

  const connect = useCallback(async () => {
    try {
      setConnectionState(ConnectionState.CONNECTING);
      setError(null);

      // 1. Initialize Audio Contexts
      // Input: 16kHz for better compatibility with Gemini Live input
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      // Output: 24kHz matches Gemini Live output
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      // Setup Analyser for visualization (attached to output for now to visualize AI voice)
      const analyserNode = outputCtx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserRef.current = analyserNode;
      setAnalyser(analyserNode);

      // 2. Get User Media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 3. Initialize Gemini API
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // 4. Connect to Live API
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: initialVoice as any } }
          },
          systemInstruction: systemInstruction,
          // Enable transcriptions
          inputAudioTranscription: { model: 'gemini-2.5-flash-native-audio-preview-09-2025' }, 
          outputAudioTranscription: { model: 'gemini-2.5-flash-native-audio-preview-09-2025' }, 
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Session Opened');
            setConnectionState(ConnectionState.CONNECTED);
            
            // Start processing microphone input
            const source = inputCtx.createMediaStreamSource(stream);
            // Use ScriptProcessor for raw PCM access (standard pattern for this API currently)
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              
              // Send to Gemini
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              }).catch(err => {
                console.error("Error sending audio:", err);
              });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
             // 1. Handle Audio Output
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio) {
                const outputCtx = outputAudioContextRef.current;
                if (outputCtx) {
                  // Track start time to ensure gapless playback
                  nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                  
                  try {
                    const audioBuffer = await decodeAudioData(
                      decodeBase64(base64Audio),
                      outputCtx,
                      24000 // Gemini output rate
                    );
                    
                    const source = outputCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    
                    // Connect to analyser for visualization and then destination
                    source.connect(analyserNode);
                    analyserNode.connect(outputCtx.destination);
                    
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    
                    audioSourcesRef.current.add(source);
                    source.onended = () => {
                      audioSourcesRef.current.delete(source);
                    };
                  } catch (e) {
                    console.error("Error decoding audio", e);
                  }
                }
             }

             // 2. Handle Interruption
             if (message.serverContent?.interrupted) {
                // Clear audio queue
                audioSourcesRef.current.forEach(src => src.stop());
                audioSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
             }

             // 3. Handle Transcription
             const serverContent = message.serverContent;
             if (serverContent) {
                if (serverContent.modelTurn) {
                   // Often transcripts come in parts or at the end
                   // We'll trust the 'turnComplete' logic or incremental updates if available
                   // Note: The SDK currently provides transcription via separate fields in serverContent
                }
                
                if (serverContent.outputTranscription?.text) {
                  currentOutputTransRef.current += serverContent.outputTranscription.text;
                }
                
                if (serverContent.inputTranscription?.text) {
                  currentInputTransRef.current += serverContent.inputTranscription.text;
                }

                if (serverContent.turnComplete) {
                   // Commit transcripts
                   if (currentInputTransRef.current) {
                      setTranscripts(prev => [...prev, {
                        text: currentInputTransRef.current,
                        isUser: true,
                        timestamp: Date.now()
                      }]);
                      currentInputTransRef.current = '';
                   }
                   if (currentOutputTransRef.current) {
                      setTranscripts(prev => [...prev, {
                         text: currentOutputTransRef.current,
                         isUser: false,
                         timestamp: Date.now()
                      }]);
                      currentOutputTransRef.current = '';
                   }
                }
             }
          },
          onclose: () => {
            console.log("Session closed");
            setConnectionState(ConnectionState.DISCONNECTED);
          },
          onerror: (err) => {
            console.error("Session error:", err);
            setError("Connection error. Please try again.");
            setConnectionState(ConnectionState.ERROR);
            disconnect();
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error("Connection failed:", err);
      setError(err.message || "Failed to connect");
      setConnectionState(ConnectionState.ERROR);
      disconnect();
    }
  }, [initialVoice, systemInstruction, disconnect]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    connectionState,
    transcripts,
    error,
    analyser
  };
};