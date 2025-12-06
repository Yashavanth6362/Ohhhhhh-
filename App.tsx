import React, { useState, useEffect, useRef } from 'react';
import { useGeminiLive } from './hooks/useGeminiLive';
import AudioVisualizer from './components/AudioVisualizer';
import { ConnectionState, Transcription } from './types';

// Icons
const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
);
const StopIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
);
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
);
const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>
);

const App: React.FC = () => {
  const [selectedVoice, setSelectedVoice] = useState('Zephyr');
  const { 
    connect, 
    disconnect, 
    connectionState, 
    transcripts, 
    error, 
    analyser 
  } = useGeminiLive({ initialVoice: selectedVoice });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcripts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  const handleToggleConnection = () => {
    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      disconnect();
    } else {
      connect();
    }
  };

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center p-4 md:p-8 font-sans">
      
      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
             <SparklesIcon />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Gemini Live
          </h1>
        </div>
        <div className="text-sm font-medium px-3 py-1 rounded-full bg-gray-900 border border-gray-800 text-gray-400">
          Native Audio Preview
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl flex-1 flex flex-col gap-6 relative">
        
        {/* Error Banner */}
        {error && (
          <div className="w-full bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3">
            <span className="block w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            {error}
          </div>
        )}

        {/* Visualizer & Controls Card */}
        <div className="w-full bg-gray-900/50 border border-gray-800 rounded-3xl p-6 md:p-8 flex flex-col items-center gap-8 shadow-2xl backdrop-blur-sm relative overflow-hidden">
          {/* Background Glow */}
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/20 blur-[100px] rounded-full transition-opacity duration-700 ${isConnected ? 'opacity-100' : 'opacity-0'}`}></div>

          <div className="w-full h-48 md:h-64 z-10 relative">
             <AudioVisualizer 
                analyser={analyser} 
                isActive={isConnected} 
                barColor="#38bdf8" 
             />
             
             {!isConnected && !isConnecting && (
               <div className="absolute inset-0 flex items-center justify-center text-gray-500 font-medium">
                 Ready to connect
               </div>
             )}
          </div>

          <div className="flex flex-col items-center gap-4 z-10">
            {/* Status Badge */}
            <div className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-colors duration-300 flex items-center gap-2 ${
              isConnected ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
              isConnecting ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 
              'bg-gray-800 text-gray-400 border border-gray-700'
            }`}>
              <span className={`block w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-400 animate-pulse' : 
                isConnecting ? 'bg-yellow-400 animate-bounce' : 
                'bg-gray-500'
              }`}></span>
              {connectionState}
            </div>

            {/* Main Action Button */}
            <button
              onClick={handleToggleConnection}
              disabled={isConnecting}
              className={`group relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-xl ${
                isConnected 
                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50' 
                  : 'bg-white text-gray-950 hover:scale-105 hover:shadow-blue-500/25'
              }`}
            >
              {isConnected ? (
                <StopIcon />
              ) : (
                <div className="relative">
                   {isConnecting && (
                     <div className="absolute inset-0 rounded-full border-2 border-gray-950 border-t-transparent animate-spin w-full h-full -m-2 p-3"></div>
                   )}
                   <MicIcon />
                </div>
              )}
            </button>
            <p className="text-gray-400 text-sm">
              {isConnected ? 'Tap to disconnect' : 'Tap to start conversation'}
            </p>
          </div>
          
          {/* Voice Selection (Only when disconnected) */}
          {!isConnected && !isConnecting && (
             <div className="flex items-center gap-3 z-10 mt-2">
                <label className="text-sm text-gray-400">Voice:</label>
                <div className="flex gap-2">
                  {['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].map((voice) => (
                    <button
                      key={voice}
                      onClick={() => setSelectedVoice(voice)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        selectedVoice === voice 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {voice}
                    </button>
                  ))}
                </div>
             </div>
          )}
        </div>

        {/* Transcript Area */}
        <div className="flex-1 bg-gray-900/30 border border-gray-800/50 rounded-3xl overflow-hidden flex flex-col min-h-[300px] relative">
           <div className="absolute top-0 left-0 right-0 p-4 bg-gray-900/80 backdrop-blur-md border-b border-gray-800/50 z-10">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Live Transcript</h2>
           </div>
           
           <div 
             ref={scrollRef}
             className="flex-1 overflow-y-auto p-4 pt-16 space-y-6 scroll-smooth"
           >
             {transcripts.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2 opacity-50">
                  <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  </div>
                  <p>Conversation history will appear here</p>
               </div>
             ) : (
               transcripts.map((msg, idx) => (
                 <div key={idx} className={`flex gap-4 ${msg.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.isUser ? 'bg-gray-700 text-gray-300' : 'bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20'
                    }`}>
                      {msg.isUser ? <UserIcon /> : <SparklesIcon />}
                    </div>
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${
                      msg.isUser 
                        ? 'bg-gray-800 text-gray-200 rounded-tr-none' 
                        : 'bg-blue-500/10 border border-blue-500/20 text-blue-100 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                 </div>
               ))
             )}
             
             {/* Typing Indicator if connected and no recent output? (Optional, kept simple) */}
           </div>
        </div>

      </main>
      
      <footer className="w-full text-center py-6 text-gray-600 text-xs">
         <p>Powered by Gemini 2.5 Flash Native Audio Preview</p>
      </footer>
    </div>
  );
};

export default App;