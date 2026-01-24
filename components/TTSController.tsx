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
  
  // Refs to handle async state without triggering unnecessary re-renders
  const isPlayingRef = useRef(false);
  const isAutoScrollingRef = useRef(false);
  const visibleSectionIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<number | null>(null);

  // 1. Monitor which section is in view to set the starting point
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleSectionIdRef.current = entry.target.id;
          }
        });
      },
      { threshold: 0.5, rootMargin: "-10% 0px -40% 0px" }
    );

    sections.forEach(s => s.subsections?.forEach((sub) => {
      const el = document.getElementById(sub.id);
      if (el) observer.observe(el);
    }));

    return () => observer.disconnect();
  }, [sections]);

  // 2. Linear Playlist Construction
  const playlist = useMemo(() => {
    const list: ReadingItem[] = [];
    sections.forEach((section) => {
      section.subsections.forEach((sub) => {
        // We push Title and Content separately for better pacing and UI feedback
        list.push({ id: sub.id, label: sub.title, text: sub.title });
        list.push({ id: sub.id, label: sub.title, text: sub.content });
      });
    });
    return list;
  }, [sections]);

  const sanitize = (text: string) => {
    return text
      .replace(/[#*_~`>]/g, '') // Remove markdown
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove link syntax
      .replace(/\n+/g, '. ') // Natural pauses
      .trim();
  };

  const stop = useCallback(() => {
    synth.cancel();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentIndex(-1);
    if (onActiveIdChange) onActiveIdChange(null);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
  }, [synth, onActiveIdChange]);

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
    if (onActiveIdChange) onActiveIdChange(item.id);

    // Smart Auto-Scroll: Only center if it's the start of a new section
    const isNewSection = index === 0 || playlist[index - 1].id !== item.id;
    if (isNewSection) {
      const element = document.getElementById(item.id);
      if (element) {
        isAutoScrollingRef.current = true;
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => { isAutoScrollingRef.current = false; }, 1000);
      }
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Voice Config (English/Tagalog Priority)
    const voices = synth.getVoices();
    const voice = voices.find(v => v.lang.includes('en-US')) || voices.find(v => v.lang.includes('tl-PH')) || voices[0];
    if (voice) utterance.voice = voice;
    
    utterance.rate = 0.95; 
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (isPlayingRef.current) {
        // Small delay between segments for natural speech
        setTimeout(() => playSegment(index + 1), 600);
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') stop();
    };

    synth.speak(utterance);
  }, [playlist, stop, synth, onActiveIdChange]);

  // 3. Manual Override Detection
  const handleInteraction = useCallback(() => {
    if (isPlayingRef.current && !isAutoScrollingRef.current) {
      stop();
    }
  }, [stop]);

  useEffect(() => {
    window.addEventListener('wheel', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [handleInteraction]);

  const handleToggle = () => {
    if (isPlaying) {
      stop();
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
      synth.cancel();

      // Mobile Stability Heartbeat
      heartbeatRef.current = window.setInterval(() => {
        if (synth.speaking && !synth.paused) {
          synth.pause();
          synth.resume();
        }
      }, 10000);

      // Find where we should start (current visible section)
      const startIdx = playlist.findIndex(item => item.id === visibleSectionIdRef.current);
      playSegment(startIdx !== -1 ? startIdx : 0);
    }
  };

  const currentItem = playlist[currentIndex];

  return (
    <div className="fixed bottom-24 lg:bottom-10 left-6 z-[70] flex flex-col items-start gap-4 pointer-events-none">
      {isPlaying && currentItem && (
        <div className="bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-pink-100 flex items-center gap-4 animate-in slide-in-from-left duration-300 pointer-events-auto">
          <div className="relative">
            <div className="w-2.5 h-2.5 bg-[#EF4E92] rounded-full absolute animate-ping"></div>
            <div className="w-2.5 h-2.5 bg-[#EF4E92] rounded-full relative"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Assistant Reading</span>
            <span className="text-xs font-black text-[#003882] uppercase truncate max-w-[150px]">
              {currentItem.label}
            </span>
          </div>
        </div>
      )}

      <button
        onClick={handleToggle}
        className={`group relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 border-4 border-white pointer-events-auto ${
          isPlaying ? 'bg-red-500 shadow-red-200' : 'bg-[#EF4E92] shadow-pink-200'
        }`}
        title={isPlaying ? "Stop Assistant" : "Listen Now (Offline AI)"}
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
        <span className="absolute -top-10 left-0 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {isPlaying ? 'Stop' : 'Listen'}
        </span>
      </button>
    </div>
  );
};

export default TTSController;