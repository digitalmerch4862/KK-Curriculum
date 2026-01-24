import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Section } from "./LessonTextTab.tsx";
import { generateTTS } from "../services/geminiService.ts";
import { X, Play } from "lucide-react";

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

// Manual base64 decoding (no external libs)
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

// Decode raw 16-bit PCM (little-endian), 24kHz, mono by default
async function decodeRawPCM(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const totalSamples = Math.floor(view.byteLength / 2); // 2 bytes per int16
  const frameCount = Math.floor(totalSamples / numChannels);

  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      const sampleIndex = i * numChannels + channel;
      const byteIndex = sampleIndex * 2;
      const int16 = view.getInt16(byteIndex, true); // little-endian
      channelData[i] = int16 / 32768;
    }
  }

  return buffer;
}

const TTSController: React.FC<TTSControllerProps> = ({
  sections,
  onActiveIdChange,
  onPlayingStatusChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingRef = useRef(false);

  // You can keep this lowercase; geminiService will normalize voice name.
  const VOICE_NAME = "kore";

  // Create a flat playlist for narration
  const playlist = useMemo(() => {
    const list: ReadingItem[] = [];
    sections.forEach((section) => {
      section.subsections.forEach((sub) => {
        // Queue Title then Content
        list.push({ id: sub.id, label: sub.title, text: sub.title });
        list.push({ id: sub.id, label: sub.title, text: sub.content });
      });
    });
    return list;
  }, [sections]);

  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const stop = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {
        // ignore
      }
      currentSourceRef.current = null;
    }

    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsLoading(false);
    onPlayingStatusChange?.(false);
    setCurrentIndex(-1);
    onActiveIdChange?.(null);
  }, [onActiveIdChange, onPlayingStatusChange]);

  const playSegment = useCallback(
    async (index: number) => {
      if (index >= playlist.length || !isPlayingRef.current) {
        stop();
        return;
      }

      const item = playlist[index];

      // ✅ SMART SKIP: If section contains "Craft", skip instead of terminating narration
      if (item.label.toLowerCase().includes("craft")) {
        console.info("Smart Skip: Detected 'Craft' section. Skipping narration for this segment.");
        playSegment(index + 1);
        return;
      }

      // Identify whether this is a "title item" (short step label)
      const isTitleItem = item.text === item.label;

      // ROBUST TEXT VALIDATION for TTS
      let sanitizedText = (item.text || "").trim();

      // If title is short (READ/PRAY/etc), pad to make it speakable
      if (isTitleItem && sanitizedText.length > 0 && sanitizedText.length < 10) {
        sanitizedText = `Next step: ${sanitizedText}`;
      }

      // Skip empty text
      if (!sanitizedText) {
        playSegment(index + 1);
        return;
      }

      // Clean problematic characters
      sanitizedText = sanitizedText
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/[^\w\s.,!?;:'\-()&]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // If still too short after cleaning, skip
      if (sanitizedText.length < 2) {
        playSegment(index + 1);
        return;
      }

      // Ensure ending punctuation
      if (!/[.!?]$/.test(sanitizedText)) {
        sanitizedText += ".";
      }

      setIsLoading(true);
      setCurrentIndex(index);
      onActiveIdChange?.(item.id);

      try {
        const base64Audio = await generateTTS(sanitizedText, VOICE_NAME);

        // If TTS returned nothing, skip forward
        if (!base64Audio || !isPlayingRef.current) {
          setIsLoading(false);
          if (isPlayingRef.current) playSegment(index + 1);
          return;
        }

        const ctx = await initAudioContext();

        const rawBytes = decodeBase64(base64Audio);
        const audioBuffer = await decodeRawPCM(rawBytes, ctx, 24000, 1);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        currentSourceRef.current = source;

        setIsLoading(false);

        // Auto-scroll to active section
        const element = document.getElementById(item.id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        source.onended = () => {
          if (isPlayingRef.current && currentSourceRef.current === source) {
            playSegment(index + 1);
          }
        };

        source.start();
      } catch (error) {
        console.error("Narrator Error:", error);
        setIsLoading(false);

        // Continue to next segment even on error
        if (isPlayingRef.current) {
          setTimeout(() => playSegment(index + 1), 300);
        }
      }
    },
    [playlist, stop, onActiveIdChange, initAudioContext]
  );

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
            <div className="w-1.5 bg-[#EF4E92] rounded-full animate-bounce [animation-duration:0.6s]"></div>
            <div className="w-1.5 bg-pink-400 rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.1s]"></div>
            <div className="w-1.5 bg-pink-300 rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.2s]"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#EF4E92]">
              Narrator Active
            </span>
            <span className="text-xs font-bold text-slate-800 uppercase truncate max-w-[150px]">
              {isLoading ? "Processing Voice..." : "Reading Lesson"}
            </span>
          </div>
        </div>
      )}

      <button
        onClick={handleToggle}
        className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 border-4 border-white ${
          isPlaying ? "bg-red-500" : "bg-[#EF4E92]"
        }`}
        title={isPlaying ? "Stop Narrator" : "Start Videoke Guide"}
      >
        {/* ✅ Fixed icon logic: show spinner only when playing + loading */}
        {isPlaying ? (
          isLoading ? (
            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <X className="text-white" size={24} strokeWidth={3} />
          )
        ) : (
          <Play className="text-white ml-1 fill-white" size={24} />
        )}
      </button>
    </div>
  );
};

export default TTSController;
