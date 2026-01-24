import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Section } from './LessonTextTab.tsx';

interface TTSControllerProps {
  sections: Section[];
  onActiveIdChange?: (id: string | null) => void;
}

interface ReadingItem {
  id: string;
  label: string;
  text: string;
}

const TTSController: React.FC<TTSControllerProps> = ({ sections, onActiveIdChange }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const synth = window.speechSynthesis;
  
  // Refs to manage internal state across async synthesis cycles without re-renders
  const isPlayingRef = useRef(false);
  const heartbeatRef = useRef<number | null>(null);

  // 1. Flatten the lesson hierarchy into a linear reading queue
  const playlist = useMemo(() => {
    const list: ReadingItem[] = [];
    sections.forEach((section) => {
      section.subsections.forEach((sub) => {
        // We push Title and Content separately for better pacing
        list.push({ id: sub.id, label: sub.title, text: sub.title });
        list.push({ id: sub.id, label: sub.title, text: sub.content });
      });
    });
    return list;
  }, [sections]);

  /**
   * Cleans markdown and ensures natural pacing
   */
  const sanitize = (text: string) => {
    return text
      .replace(/[#*_~`>]/g, '') // Strip markdown characters
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Keep link labels, remove URLs
      .replace(/\n+/g, '. ') // Newlines become natural pauses
      .trim();
  };

  /**
   * Resets the synthesis engine and UI state
   */
  const stop = useCallback(() => {
    synth.cancel();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentIndex(-1);
    if (onActiveIdChange) onActiveIdChange(null);
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, [synth, onActiveIdChange]);

  /**
   * Primary recursive playback engine - continuous and scroll-independent
   */
  const playSegment = useCallback((index: number) => {
    if (index >= playlist.length || !isPlayingRef.current) {
      stop();
      return;
    }

    const item = playlist[index];
    const cleanText = sanitize(item.text);

    // Skip empty segments or those with no readable content
    if (!cleanText) {
      playSegment(index + 1);
      return;
    }

    setCurrentIndex(index);
    if (onActiveIdChange) onActiveIdChange(item.id);

    // Auto-Scroll Logic: Center the active card in the viewport
    const isNewSection = index === 0 || playlist[index - 1].id !== item.id;
    if (isNewSection) {
      const element = document.getElementById(item.id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Voice Config (Prioritize English or Regional voices)
    const voices = synth.getVoices();
    const voice = voices.find(v => v.lang.includes('en-US')) || 
                  voices.find(v => v.lang.includes('en')) || 
                  voices[0];
    
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95; // Slightly slower for clear instruction
    utterance.pitch = 1.0;

    // Trigger the next segment immediately upon finishing the current one
    utterance.onend = () => {
      if (isPlayingRef.current) {
        // Natural 600ms transition delay
        setTimeout(() => playSegment(index + 1), 600);
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') {
        console.error('KingdomKids TTS Error:', e);
        stop();
      }
    };

    synth.speak(utterance);
  }, [playlist, stop, synth, onActiveIdChange]);

  const handleToggle = () => {
    if (isPlaying) {
      stop();
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
      
      // Reset any hung utterances
      synth.cancel();

      // Mobile Stability Heartbeat: pause/resume pulse prevents process sleep
      heartbeatRef.current = window.setInterval(() => {
        if (synth.speaking && !synth.paused) {
          synth.pause();
          synth.resume();
        }
      }, 10000);

      playSegment(0);
    }
  };

  // Cleanup synthesis on component unmount
  useEffect(() => {
    return () => stop();
  }, [stop]);

  const currentItem = playlist[currentIndex];

  return (
    <div className="fixed bottom-24 lg:bottom-10 left-6 z-[70] flex flex-col items-start gap-4">
      {/* Dynamic Reading Status Indicator */}
      {isPlaying && currentItem && (
        <div className="bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-pink-100 flex items-center gap-4 animate-in slide-in-from-left duration-300">
          <div className="relative">
            <div className="w-2.5 h-2.5 bg-[#EF4E92] rounded-full absolute animate-ping"></div>
            <div className="w-2.5 h-2.5 bg-[#EF4E92] rounded-full relative"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Lesson Assistant</span>
            <span className="text-xs font-black text-[#003882] uppercase truncate max-w-[150px]">
              {currentItem.label}
            </span>
          </div>
        </div>
      )}

      {/* Persistent Control Button */}
      <button
        onClick={handleToggle}
        className={`group relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 border-4 border-white ${
          isPlaying ? 'bg-red-500 shadow-red-200' : 'bg-[#EF4E92] shadow-pink-200'
        }`}
        aria-label={isPlaying ? "Stop Assistant" : "Play Assistant"}
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
        
        {/* Tooltip */}
        <span className="absolute -top-10 left-0 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl">
          {isPlaying ? 'Stop Audio' : 'Start Reading'}
        </span>
      </button>
    </div>
  );
};

export default TTSController;