import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/supabaseService.ts';
import { Lesson, Profile } from '../types.ts';
import ActivityCard from '../components/ActivityCard.tsx';
import VideoEmbed from '../components/VideoEmbed.tsx';
import LessonTextTab, { parseContent } from '../components/LessonTextTab.tsx';
import TTSController from '../components/TTSController.tsx';

interface LessonDetailProps {
  lessonId: string;
  user: Profile;
  onBack: () => void;
}

const getGoogleDriveLinks = (url: string) => {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const fileId = match ? match[1] : null;
  if (!fileId) return { preview: url, download: url, isGoogleDrive: false };
  return {
    preview: `https://drive.google.com/file/d/${fileId}/preview`,
    download: `https://drive.google.com/uc?export=download&id=${fileId}`,
    isGoogleDrive: true
  };
};

const LessonDetail: React.FC<LessonDetailProps> = ({ lessonId, user, onBack }) => {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeReadingId, setActiveReadingId] = useState<string | null>(null);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await db.lessons.get(lessonId);
        setLesson(data);
        const prog = await db.progress.get(lessonId, user.id);
        setCompleted(prog?.completed || false);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetch();
  }, [lessonId, user.id]);

  const toggleComplete = async () => {
    try {
      await db.progress.toggle(lessonId, user.id);
      setCompleted(!completed);
    } catch (e) {
      alert("Error updating progress");
    }
  };

  const handlePrint = (url: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    };
  };

  const sections = useMemo(() => {
    if (!lesson?.content) return [];
    return parseContent(lesson.content);
  }, [lesson?.content]);

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse font-black text-gray-300">Loading Masterpiece...</div>;
  if (!lesson) return <div className="p-10 text-center">Lesson not found.</div>;

  const navItems = [
    ...sections.map(s => ({ 
      id: s.id, 
      label: s.title,
      subsections: s.subsections.map(sub => ({ id: sub.id, label: sub.title }))
    })),
    { id: 'activities-section', label: 'Activities', subsections: [] },
    { id: 'resources-section', label: 'Resources', subsections: [] }
  ];

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-0">
      <TTSController 
        sections={sections} 
        onActiveIdChange={setActiveReadingId} 
        onPlayingStatusChange={setIsTTSPlaying}
      />

      {/* MOBILE NAVIGATION FAB (STACKED TOP) */}
      <button 
        onClick={() => setIsMobileMenuOpen(true)}
        className="fixed bottom-24 right-6 z-50 lg:hidden w-16 h-16 bg-[#EF4E92] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all"
        aria-label="Navigation Menu"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* MOBILE HOME FAB (STACKED BOTTOM) */}
      <button 
        onClick={onBack}
        className="fixed bottom-6 right-6 z-50 lg:hidden w-16 h-16 bg-[#003882] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all"
        aria-label="Return Home"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </button>

      <header className="sticky top-0 z-50 bg-white border-b border-gray-50 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between shadow-sm">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="text-center px-4 overflow-hidden flex-1">
          <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-gray-400 truncate">{lesson.category} • {lesson.series}</p>
          <h1 className="text-xs md:text-sm font-black truncate text-gray-900">{lesson.title}</h1>
        </div>
        <button onClick={toggleComplete} className={`shrink-0 flex items-center gap-2 px-4 md:px-8 py-2 md:py-3 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${completed ? 'bg-green-500 text-white' : 'bg-[#EF4E92] text-white'}`}>
          {completed ? 'Done' : 'Complete'}
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-32 space-y-10">
              <nav className="space-y-4">
                {navItems.map((item) => (
                  <div key={item.id} className="space-y-1">
                    <button onClick={() => scrollToSection(item.id)} className="block w-full text-left text-[11px] font-black uppercase tracking-wider text-[#EF4E92] hover:text-black transition-colors py-1 flex items-center gap-2 group">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#EF4E92]"></div>
                      {item.label}
                    </button>
                  </div>
                ))}
              </nav>
            </div>
          </aside>

          <div className="lg:col-span-9 space-y-24">
            <LessonTextTab 
              content={lesson.content} 
              activeReadingId={activeReadingId} 
              onActiveIdChange={setActiveReadingId}
              isPlaying={isTTSPlaying}
            />

            <section id="activities-section" className="space-y-12 pt-12 border-t border-gray-100 scroll-mt-32">
              <div className="flex items-center gap-6">
                <h2 className="shrink-0 text-sm font-black uppercase tracking-[0.3em] text-[#EF4E92]">Interactive Activities</h2>
                <div className="flex-1 h-px bg-gray-100"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {lesson.activities?.map(activity => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LessonDetail;