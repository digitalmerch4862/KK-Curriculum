import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Section } from './LessonTextTab.tsx';

interface TTSControllerProps {
  sections: Section[];
  onActiveIdChange?: (id: string | null) => void;
  onPlayingStatusChange?: (isPlaying: boolean) => void;
}

interface ReadingItem {
  id: string;
  label: string;
  text: string;
}

const TTSController: React.FC<TTSControllerProps> = ({ 
  sections, 
  onActiveIdChange,
  onPlayingStatusChange 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const synth = window.speechSynthesis;
  
  const isPlayingRef = useRef(false);
  const heartbeatRef = useRef<number | null>(null);

  // ✅ CRITICAL FIX: Combine title and content into ONE playlist item
  const playlist = useMemo(() => {
    const list: ReadingItem[] = [];
    sections.forEach((section) => {
      section.subsections.forEach((sub) => {
        // Combine title and content with natural pause
        const fullText = `${sub.title}. ${sub.content}`;
        list.push({ 
          id: sub.id, 
          label: sub.title, 
          text: fullText 
        });
      });
    });
    console.log('📋 Generated Playlist:', list.map(i => ({ id: i.id, label: i.label })));
    return list;
  }, [sections]);

  const sanitize = (text: string) => {
    return text
      .replace(/[#*_~`>]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\n+/g, '. ')
      .trim();
  };

  const stop = useCallback(() => {
    console.log('⏹️ Stopping playback');
    synth.cancel();
    isPlayingRef.current = false;
    setIsPlaying(false);
    onPlayingStatusChange?.(false);
    setCurrentIndex(-1);
    if (onActiveIdChange) onActiveIdChange(null);
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, [synth, onActiveIdChange, onPlayingStatusChange]);

  const playSegment = useCallback((index: number) => {
    if (index >= playlist.length || !isPlayingRef.current) {
      stop();
      return;
    }

    const item = playlist[index];
    const cleanText = sanitize(item.text);

    if (!cleanText) {
      console.warn(`⚠️ Empty text for segment ${index}, skipping...`);
      playSegment(index + 1);
      return;
    }

    console.log(`▶️ Playing segment ${index}/${playlist.length - 1}:`, { 
      id: item.id, 
      label: item.label,
      textPreview: cleanText.substring(0, 50) + '...'
    });

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = synth.getVoices();
    const voice = voices.find(v => v.lang.includes('en-US')) || 
                  voices.find(v => v.lang.includes('en')) || 
                  voices[0];
    
    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    // ✅ CRITICAL: Update highlight and scroll IMMEDIATELY when speech starts
    utterance.onstart = () => {
      console.log(`✅ Speech started for: ${item.id}`);
      
      // Update state FIRST
      setCurrentIndex(index);
      onActiveIdChange?.(item.id);

      // Then scroll with better timing
      requestAnimationFrame(() => {
        const element = document.getElementById(item.id);
        
        if (element) {
          console.log(`📍 Scrolling to element: ${item.id} - FOUND`);
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
        } else {
          console.error(`❌ Element NOT FOUND: ${item.id}`);
        }
      });
    };

    utterance.onend = () => {
      console.log(`✓ Finished segment ${index}`);
      if (isPlayingRef.current) {
        setTimeout(() => playSegment(index + 1), 300);
      }
    };

    utterance.onerror = (e) => {
      console.error(`❌ TTS Error on segment ${index}:`, e.error);
      if (e.error !== 'interrupted') {
        stop();
      }
    };

    synth.speak(utterance);
  }, [playlist, stop, synth, onActiveIdChange]);

  const handleToggle = () => {
    if (isPlaying) {
      stop();
    } else {
      console.log('🎬 Starting playback...');
      isPlayingRef.current = true;
      setIsPlaying(true);
      onPlayingStatusChange?.(true);
      synth.cancel();

      // Heartbeat to prevent browser from pausing long speeches
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
    return () => {
      console.log('🧹 Cleaning up TTS controller');
      stop();
    };
  }, [stop]);

  const currentItem = playlist[currentIndex];

  return (
    <div className="fixed bottom-24 lg:bottom-10 left-6 z-[70] flex flex-col items-start gap-4">
      {isPlaying && currentItem && (
        <div className="bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-pink-100 flex items-center gap-4 animate-in slide-in-from-left duration-300">
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
        className={`group relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 border-4 border-white ${
          isPlaying ? 'bg-red-500 shadow-red-200' : 'bg-[#EF4E92] shadow-pink-200'
        }`}
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
      </button>
    </div>
  );
};

export default TTSController;