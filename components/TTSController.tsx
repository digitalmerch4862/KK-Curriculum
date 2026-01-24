import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Section } from './LessonTextTab.tsx';

interface TTSControllerProps {
  sections: Section[];
}

interface ReadingItem {
  id: string;
  label: string;
  text: string;
}

const TTSController: React.FC<TTSControllerProps> = ({ sections }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const synth = window.speechSynthesis;
  
  // Refs to manage internal state across async synthesis events without stale closures
  const isPlayingRef = useRef(false);
  const lastActivityRef = useRef(0);
  const heartbeatRef = useRef<number | null>(null);

  // Monitor manual user scrolling and touch to disable auto-scrolling override
  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener('wheel', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });
    window.addEventListener('mousedown', handleActivity, { passive: true });
    
    // Explicitly initialize the voices list for broader browser compatibility
    const initVoices = () => synth.getVoices();
    synth.onvoiceschanged = initVoices;
    initVoices();

    return () => {
      window.removeEventListener('wheel', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      synth.onvoiceschanged = null;
    };
  }, [synth]);

  // Flatten the lesson sections into a linear queue of titles and content
  const playlist = useMemo(() => {
    const list: ReadingItem[] = [];
    sections.forEach((section) => {
      section.subsections.forEach((sub) => {
        // Read Title then Content as separate segments for stability and progress tracking
        list.push({ id: sub.id, label: sub.title, text: sub.title });
        list.push({ id: sub.id, label: sub.title, text: sub.content });
      });
    });
    return list;
  }, [sections]);

  // Sanitize text by stripping markdown syntax
  const sanitize = (text: string) => {
    return text
      .replace(/[#*_~`>]/g, '') // Remove common markdown symbols
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Strip link URL but keep text label
      .replace(/\n+/g, '. ') // Replace newlines with full stops for natural pauses
      .trim();
  };

  const stop = useCallback(() => {
    synth.cancel();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentIndex(-1);
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, [synth]);

  const playSegment = useCallback((index: number) => {
    if (index >= playlist.length || !isPlayingRef.current) {
      stop();
      return;
    }

    const item = playlist[index];
    const cleanText = sanitize(item.text);

    if (!cleanText) {
      playSegment(index + 1);
      return;
    }

    setCurrentIndex(index);

    // Smart Scrolling: Only move the view if the user hasn't scrolled in 3s
    const now = Date.now();
    const isNewSection = index === 0 || playlist[index - 1].id !== item.id;
    if (isNewSection && now - lastActivityRef.current > 3000) {
      const element = document.getElementById(item.id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Prioritize English and Tagalog voices
    const voices = synth.getVoices();
    const voice = 
      voices.find(v => v.lang.startsWith('en-US')) || 
      voices.find(v => v.lang.startsWith('en')) ||
      voices.find(v => v.lang.startsWith('tl-PH')) ||
      voices[0];
    
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95; // Slightly slower instructional pace
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (isPlayingRef.current) {
        // Natural transition delay before next segment
        setTimeout(() => playSegment(index + 1), 600);
      }
    };

    utterance.onerror = (e) => {
      // Interrupted events are expected during stop/cancel
      if (e.error !== 'interrupted') {
        console.error('SpeechSynthesis Playback Error:', e);
        stop();
      }
    };

    synth.speak(utterance);
  }, [playlist, stop, synth]);

  const handleToggle = () => {
    if (isPlaying) {
      stop();
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
      synth.cancel(); // Clear any existing queue
      
      // Heartbeat: Periodically pulsing pause/resume prevents mobile timeouts
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = window.setInterval(() => {
        if (synth.speaking && !synth.paused) {
          synth.pause();
          synth.resume();
        }
      }, 10000);

      playSegment(0);
    }
  };

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const currentSegment = playlist[currentIndex];

  return (
    <div className="fixed bottom-24 lg:bottom-10 left-6 z-[70] flex flex-col items-start gap-4">
      {/* Active Section Toast */}
      {isPlaying && currentSegment && (
        <div className="bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-pink-100 flex items-center gap-4 animate-in slide-in-from-left duration-300">
          <div className="relative flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-[#EF4E92] rounded-full absolute animate-ping"></div>
            <div className="w-2.5 h-2.5 bg-[#EF4E92] rounded-full relative"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
              Reading Lesson
            </span>
            <span className="text-xs font-black text-[#003882] uppercase truncate max-w-[160px]">
              {currentSegment.label}
            </span>
          </div>
        </div>
      )}

      {/* Main Controller FAB */}
      <button
        onClick={handleToggle}
        className={`group relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 border-4 border-white ${
          isPlaying ? 'bg-red-500 shadow-red-100' : 'bg-[#EF4E92] shadow-pink-100'
        }`}
        aria-label={isPlaying ? 'Stop Audio' : 'Play Audio'}
      >
        {isPlaying ? (
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-white ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
        
        <div className="absolute -top-10 left-0 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
          {isPlaying ? 'Stop Assistant' : 'Listen Now (Offline)'}
        </div>
      </button>
    </div>
  );
};

export default TTSController;