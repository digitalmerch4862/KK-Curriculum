
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/supabaseService.ts';
import { Lesson, Profile } from '../types.ts';
import ActivityCard from '../components/ActivityCard.tsx';
import VideoEmbed from '../components/VideoEmbed.tsx';
import LessonTextTab, { parseContent } from '../components/LessonTextTab.tsx';

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
      const offset = 100;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
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
      {/* PREVIEW MODAL */}
      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full h-full max-w-6xl rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col">
            <div className="p-6 flex items-center justify-between border-b border-gray-100">
              <h3 className="font-black text-xs uppercase tracking-widest text-gray-400">Resource Preview</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => handlePrint(downloadUrl || previewUrl)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-[#EF4E92] hover:text-white transition-all shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                </button>
                <button onClick={() => { setPreviewUrl(null); setDownloadUrl(null); }} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-[#EF4E92] hover:text-white transition-all shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50">
              <iframe src={previewUrl} className="w-full h-full border-none" allow="autoplay" title="Document Preview" />
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM SHEET MENU */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[40px] p-8 animate-in slide-in-from-bottom duration-300 border-t border-gray-100 shadow-2xl max-h-[80vh] overflow-y-auto">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6 px-2">Jump to Section</h4>
            <div className="space-y-2">
              {navItems.map((item) => (
                <div key={item.id} className="space-y-1">
                  <button
                    onClick={() => scrollToSection(item.id)}
                    className="w-full text-left py-4 px-6 rounded-2xl bg-gray-50 text-sm font-black text-gray-800 uppercase tracking-widest hover:bg-[#EF4E92] hover:text-white transition-all active:scale-[0.98]"
                  >
                    {item.label}
                  </button>
                  {item.subsections.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => scrollToSection(sub.id)}
                      className="w-full text-left py-2 px-10 text-[11px] font-bold text-gray-400 uppercase tracking-wider hover:text-[#EF4E92] transition-all"
                    >
                      • {sub.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE NAVIGATION FAB (STACKED TOP) */}
      <button 
        onClick={() => setIsMobileMenuOpen(true)}
        className="fixed bottom-24 right-6 z-50 lg:hidden w-16 h-16 bg-[#EF4E92] text-white rounded-full shadow-2xl shadow-pink-200 flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
        aria-label="Navigation Menu"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* MOBILE HOME FAB (STACKED BOTTOM) */}
      <button 
        onClick={onBack}
        className="fixed bottom-6 right-6 z-50 lg:hidden w-16 h-16 bg-[#003882] text-white rounded-full shadow-2xl shadow-blue-200 flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-2 border-white/10"
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
        <button onClick={toggleComplete} className={`shrink-0 flex items-center gap-2 px-4 md:px-8 py-2 md:py-3 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${completed ? 'bg-green-500 text-white shadow-lg' : 'bg-[#EF4E92] text-white shadow-lg shadow-[#EF4E92]/20'}`}>
          {completed ? 'Done' : 'Complete'}
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* DESKTOP SIDEBAR - SINGLE COLUMN */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-32 space-y-10">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-8">Lesson Pathway</h4>
                <nav className="space-y-4">
                  {navItems.map((item) => (
                    <div key={item.id} className="space-y-1">
                      <button
                        onClick={() => scrollToSection(item.id)}
                        className="block w-full text-left text-[11px] font-black uppercase tracking-wider text-[#EF4E92] hover:text-black transition-colors py-1 flex items-center gap-2 group"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-[#EF4E92] group-hover:scale-125 transition-transform"></div>
                        {item.label}
                      </button>
                      <div className="pl-4 border-l-2 border-gray-100 space-y-1">
                        {item.subsections.map(sub => (
                          <button
                            key={sub.id}
                            onClick={() => scrollToSection(sub.id)}
                            className="block w-full text-left text-[11px] font-medium text-gray-400 hover:text-[#EF4E92] transition-colors py-0.5 truncate"
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </nav>
              </div>
              <div className="p-8 bg-pink-50/30 rounded-[40px] border border-pink-100/50">
                <p className="text-[10px] font-black text-[#EF4E92] uppercase tracking-[0.2em] leading-relaxed">
                  Focus Point: Engage every child through storytelling and hands-on crafts.
                </p>
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <div className="lg:col-span-9 space-y-24">
            {/* LESSON BODY (READ, TEACH, ENGAGE) */}
            <LessonTextTab content={lesson.content} />

            {/* INTERACTIVE ACTIVITIES */}
            <section id="activities-section" className="space-y-12 pt-12 border-t border-gray-100 scroll-mt-32">
              <div className="flex items-center gap-6">
                <h2 className="shrink-0 text-sm font-black uppercase tracking-[0.3em] text-[#EF4E92]">Interactive Activities</h2>
                <div className="flex-1 h-px bg-gray-100"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {lesson.activities?.length ? (
                  lesson.activities.map(activity => (
                    <ActivityCard key={activity.id} activity={activity} />
                  ))
                ) : (
                  <div className="col-span-full py-20 bg-gray-50 rounded-[48px] text-center text-gray-400 font-bold uppercase tracking-widest text-xs">No activities configured.</div>
                )}
              </div>
            </section>

            {/* RESOURCES & DOWNLOADS */}
            <section id="resources-section" className="space-y-12 pt-12 border-t border-gray-100 scroll-mt-32">
              <div className="flex items-center gap-6">
                <h2 className="shrink-0 text-sm font-black uppercase tracking-[0.3em] text-[#EF4E92]">Resources & Downloads</h2>
                <div className="flex-1 h-px bg-gray-100"></div>
              </div>
              
              <div className="space-y-16">
                <div className="space-y-8">
                  <h3 className="text-xl font-black uppercase text-gray-900 tracking-tight flex items-center gap-3">
                    <span className="w-1.5 h-6 bg-[#EF4E92] rounded-full"></span> Lesson Videos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {lesson.videos?.length ? (
                      lesson.videos.map(video => (
                        <div key={video.id} className="space-y-4 bg-gray-50 p-6 rounded-[32px] border border-gray-100/50">
                          <h4 className="font-black text-sm text-gray-800 uppercase tracking-wide truncate">{video.title || 'Instructional Video'}</h4>
                          <VideoEmbed url={video.url} />
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 font-medium py-10 text-center col-span-full">No videos available.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-8">
                  <h3 className="text-xl font-black uppercase text-gray-900 tracking-tight flex items-center gap-3">
                    <span className="w-1.5 h-6 bg-gray-900 rounded-full"></span> Handouts
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {lesson.attachments?.length ? (
                      lesson.attachments.map(att => {
                        const driveLinks = getGoogleDriveLinks(att.storage_path);
                        return (
                          <div key={att.id} className="p-6 bg-white border border-gray-100 rounded-[32px] flex items-center justify-between hover:border-[#EF4E92] transition-all shadow-sm group">
                            <div className="flex-1 min-w-0 pr-4">
                              <p className="font-black text-sm truncate text-gray-900 uppercase tracking-wide">{att.name}</p>
                              <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{att.type || 'PDF'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setPreviewUrl(driveLinks?.preview || att.storage_path); setDownloadUrl(driveLinks?.download || att.storage_path); }} className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-[#EF4E92] hover:text-white transition-all shadow-sm">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-full py-12 border-2 border-dashed border-gray-100 rounded-[40px] text-center text-gray-300 font-black text-[10px] uppercase tracking-widest">No downloads</div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LessonDetail;
