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
  
  const isPlayingRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const activeSectionIdRef = useRef<string | null>(null);
  const isAutoScrollingRef = useRef(false);

  // 1. Intersection Observer para malaman kung ano ang nasa screen
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            activeSectionIdRef.current = entry.target.id;
          }
        });
      },
      { threshold: 0.5, rootMargin: "-10% 0px -40% 0px" } 
    );

    sections.forEach(s => s.subsections.forEach(sub => {
      const el = document.getElementById(sub.id);
      if (el) observerRef.current?.observe(el);
    }));

    return () => observerRef.current?.disconnect();
  }, [sections]);

  const playlist = useMemo(() => {
    const list: ReadingItem[] = [];
    sections.forEach((section) => {
      section.subsections.forEach((sub) => {
        list.push({ id: sub.id, label: sub.title, text: sub.title });
        list.push({ id: sub.id, label: sub.title, text: sub.content });
      });
    });
    return list;
  }, [sections]);

  const sanitize = (text: string) => {
    return text.replace(/[#*_~`>]/g, '').replace(/\n+/g, '. ').trim();
  };

  const stop = useCallback(() => {
    synth.cancel();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentIndex(-1);
  }, [synth]);

  const playSegment = useCallback((index: number) => {
    if (index >= playlist.length || !isPlayingRef.current) {
      stop();
      return;
    }

    const item = playlist[index];
    const cleanText = sanitize(item.text);
    if (!cleanText) { playSegment(index + 1); return; }

    setCurrentIndex(index);

    // FIX: Mas accurate na auto-scroll logic
    const isNewSection = index === 0 || playlist[index - 1].id !== item.id;
    if (isNewSection) {
      const element = document.getElementById(item.id);
      if (element) {
        isAutoScrollingRef.current = true;
        // Ginamit ang 'center' para laging nasa gitna ang binabasa
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Timeout para i-reset ang flag pagkatapos ng scroll animation
        setTimeout(() => { isAutoScrollingRef.current = false; }, 1000);
      }
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;

    // Tuloy-tuloy na pagbabasa (Recursive Playlist Logic)
    utterance.onend = () => {
      if (isPlayingRef.current) {
        setTimeout(() => playSegment(index + 1), 400); // Mas mabilis na transition
      }
    };

    synth.speak(utterance);
  }, [playlist, stop, synth]);

  // 2. Manual Scroll Detection: Titigil ang audio kapag ginalaw ng user ang screen
  const handleUserInteraction = useCallback(() => {
    if (!isPlayingRef.current || isAutoScrollingRef.current) return;

    // Kapag naramdaman ang manual scroll o touch, stop agad
    synth.cancel();
    setIsPlaying(false); 
    isPlayingRef.current = false; 
  }, [synth]);

  useEffect(() => {
    window.addEventListener('wheel', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [handleUserInteraction]);

  const handleToggle = () => {
    if (isPlaying) {
      stop();
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
      synth.cancel();
      
      // Magsisimula sa kung ano ang kasalukuyang nasa gitna ng screen
      const startIndex = playlist.findIndex(item => item.id === activeSectionIdRef.current);
      playSegment(startIndex !== -1 ? startIndex : 0);
    }
  };

  return (
    <div className="fixed bottom-24 lg:bottom-10 left-6 z-[70] flex flex-col items-start gap-4">
      {isPlaying && (
        <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-xl shadow-xl border border-pink-100 flex items-center gap-2">
          <div className="w-2 h-2 bg-[#EF4E92] rounded-full animate-ping"></div>
          <span className="text-[10px] font-black text-[#EF4E92] uppercase">Reading...</span>
        </div>
      )}
      <button
        onClick={handleToggle}
        className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all border-4 border-white ${
          isPlaying ? 'bg-red-500' : 'bg-[#EF4E92]'
        }`}
      >
        {isPlaying ? (
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
        ) : (
          <svg className="w-8 h-8 text-white ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707L12 5z" /></svg>
        )}
      </button>
    </div>
  );
};

export default TTSController;