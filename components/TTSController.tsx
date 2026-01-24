import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Section } from './LessonTextTab.tsx';
import { generateTTS } from '../services/geminiService.ts';
import { X, Play } from 'lucide-react';

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

/**
 * Manual base64 decoding helper.
 * Do not use external libraries like js-base64.
 */
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Manual raw PCM decoding for Gemini TTS output.
 * Gemini TTS returns raw PCM (no header), so decodeAudioData native method won't work.
 */
async function decodeRawPCMToAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert 16-bit PCM to float normalized [-1, 1]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const TTSController: React.FC<TTSControllerProps> = ({ 
  sections, 
  onActiveIdChange,
  onPlayingStatusChange 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingRef = useRef(false);

  // Requirement: Voice ID CwhRBWXzGAHq8TQ4Fs17
  const VOICE_ID = 'CwhRBWXzGAHq8TQ4Fs17'; 

  const playlist = useMemo(() => {
    const list: ReadingItem[] = [];
    sections.forEach((section) => {
      section.subsections.forEach((sub) => {
        // We push both title and content to create a natural reading flow
        list.push({ id: sub.id, label: sub.title, text: sub.title });
        list.push({ id: sub.id, label: sub.title, text: sub.content });
      });
    });
    return list;
  }, [sections]);

  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const stop = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {
        // Already stopped or error
      }
      currentSourceRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    onPlayingStatusChange?.(false);
    setCurrentIndex(-1);
    if (onActiveIdChange) onActiveIdChange(null);
  }, [onActiveIdChange, onPlayingStatusChange]);

  const playSegment = useCallback(async (index: number) => {
    if (index >= playlist.length || !isPlayingRef.current) {
      stop();
      return;
    }

    const item = playlist[index];
    
    // Requirement: SMART STOP LOGIC - Stop if text contains "Craft"
    if (item.label.toLowerCase().includes('craft')) {
      console.log("KingdomKids Logic: Stopping at Crafts section.");
      stop();
      return;
    }

    const sanitizedText = item.text.trim();
    if (!sanitizedText || sanitizedText.length < 2) {
      playSegment(index + 1);
      return;
    }

    setIsLoading(true);
    setCurrentIndex(index);
    onActiveIdChange?.(item.id);

    try {
      // Use Gemini TTS via the service
      const base64Audio = await generateTTS(sanitizedText, VOICE_ID);
      
      if (!base64Audio || !isPlayingRef.current) {
        setIsLoading(false);
        if (isPlayingRef.current) playSegment(index + 1);
        return;
      }

      const ctx = await initAudioContext();
      const rawBytes = decodeBase64(base64Audio);

      // Manual PCM Decoding as required by instructions
      const audioBuffer = await decodeRawPCMToAudioBuffer(rawBytes, ctx, 24000, 1);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      currentSourceRef.current = source;
      
      setIsLoading(false);

      // Requirement: Videoke Guide - Scroll active card to center
      const element = document.getElementById(item.id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      source.onended = () => {
        if (isPlayingRef.current && currentSourceRef.current === source) {
          playSegment(index + 1);
        }
      };
      source.start();
    } catch (error) {
      console.error("Narrator System Error:", error);
      setIsLoading(false);
      // Skip error and try next
      if (isPlayingRef.current) setTimeout(() => playSegment(index + 1), 1000);
    }
  }, [playlist, stop, onActiveIdChange, initAudioContext]);

  const handleToggle = async () => {
    if (isPlaying) {
      stop();
    } else {
      await initAudioContext();
      isPlayingRef.current = true;
      setIsPlaying(true);
      onPlayingStatusChange?.(true);
      playSegment(0);
    }
  };

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return (
    <div className="fixed bottom-24 left-6 z-[80] flex flex-col items-start gap-4">
      {isPlaying && (
        <div className="bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-pink-100 flex items-center gap-4 animate-in slide-in-from-left duration-500">
          <div className="flex gap-1.5 items-end h-4">
            <div className="w-1.5 bg-pink-500 rounded-full animate-bounce [animation-duration:0.6s]"></div>
            <div className="w-1.5 bg-pink-400 rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.1s]"></div>
            <div className="w-1.5 bg-pink-300 rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.2s]"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#EF4E92]">Narrator Active</span>
            <span className="text-xs font-bold text-slate-800 uppercase truncate max-w-[150px]">
              {isLoading ? 'Architecting...' : 'Reading Lesson'}
            </span>
          </div>
        </div>
      )}

      <button
        onClick={handleToggle}
        className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 border-4 border-white ${
          isPlaying ? 'bg-red-500' : 'bg-[#EF4E92]'
        }`}
        title={isPlaying ? "Stop Narrator" : "Start Videoke Guide"}
      >
        {isPlaying ? (
          <X className="text-white" size={24} strokeWidth={3} />
        ) : isLoading && isPlaying ? (
          <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <Play className="text-white ml-1 fill-white" size={24} />
        )}
      </button>
    </div>
  );
};

export default TTSController;