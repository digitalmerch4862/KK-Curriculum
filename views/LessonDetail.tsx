
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/supabaseService.ts';
import { Lesson, Profile, Attachment } from '../types.ts';
import ActivityCard from '../components/ActivityCard.tsx';
import VideoEmbed from '../components/VideoEmbed.tsx';
import LessonTextTab, { parseContent } from '../components/LessonTextTab.tsx';
import TTSController from '../components/TTSController.tsx';
import { ChevronLeft, CheckCircle2, FileText, Eye, Download, X } from 'lucide-react';

interface LessonDetailProps {
  lessonId: string;
  user: Profile;
  onBack: () => void;
}

const LessonDetail: React.FC<LessonDetailProps> = ({ lessonId, user, onBack }) => {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeReadingId, setActiveReadingId] = useState<string | null>(null);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [viewingResource, setViewingResource] = useState<Attachment | null>(null);
  
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

  /**
   * Converts a standard Google Drive share link to a /preview link for embedding in iframes.
   */
  const getViewableUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
      const idMatch = url.match(/\/d\/([^\/]+)/);
      if (idMatch && idMatch[1]) {
        return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
      }
    }
    return url;
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sections = useMemo(() => {
    if (!lesson?.content) return [];
    return parseContent(lesson.content);
  }, [lesson?.content]);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-slate-300 uppercase tracking-widest animate-pulse">Loading Mission...</div>;
  if (!lesson) return <div className="p-10 text-center">Lesson not found.</div>;

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-40">
      <TTSController 
        sections={sections} 
        onActiveIdChange={setActiveReadingId} 
        onPlayingStatusChange={setIsTTSPlaying}
      />

      {/* --- RESOURCE PREVIEW (OPEN INSIDE APP) --- */}
      {viewingResource && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-md p-0 md:p-4">
          <div className="bg-white w-full max-w-6xl h-full md:h-[90vh] md:rounded-[40px] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-4 md:p-6 border-b flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="text-[#EF4E92] shrink-0" />
                <h3 className="font-black text-sm md:text-xl truncate text-[#003882]">{viewingResource.name}</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => handleDownload(viewingResource.storage_path, viewingResource.name)} 
                  className="bg-[#003882] text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#002b66] transition-colors shadow-lg shadow-blue-100"
                >
                  <Download size={14} /> Download
                </button>
                <button onClick={() => setViewingResource(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-900"><X /></button>
              </div>
            </div>
            <div className="flex-1 w-full bg-slate-50 flex items-center justify-center relative">
              <iframe 
                src={getViewableUrl(viewingResource.storage_path)} 
                className="w-full h-full border-none bg-white" 
                title="Resource View" 
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      )}

      {/* STICKY HEADER */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors shrink-0">
            <ChevronLeft size={24} />
          </button>
          <div className="text-center flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 truncate">{lesson.category}</p>
            <h1 className="text-sm font-black truncate text-[#003882] uppercase">{lesson.title}</h1>
          </div>
          <button onClick={toggleComplete} className={`shrink-0 flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${completed ? 'bg-emerald-500 text-white' : 'bg-[#EF4E92] text-white shadow-lg shadow-pink-100'}`}>
            {completed ? 'Finished' : 'Mark Done'}
          </button>
        </div>
      </header>

      {/* STRICT SINGLE COLUMN CONTENT */}
      <main className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        <div className="space-y-32">
          {/* Main Content Blocks */}
          <LessonTextTab 
            content={lesson.content} 
            activeReadingId={activeReadingId} 
            onActiveIdChange={setActiveReadingId}
            isPlaying={isTTSPlaying}
          />

          {/* Activity Section */}
          <section id="activities-hub" className="space-y-12 pt-12 border-t border-slate-200 scroll-mt-32">
            <div className="flex items-center gap-4">
              <div className="w-2 h-10 bg-[#EF4E92] rounded-full"></div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-[#003882]">Interactive Activities</h2>
            </div>
            <div className="grid grid-cols-1 gap-10">
              {lesson.activities?.map(activity => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          </section>

          {/* Resource Section */}
          <section id="resources-hub" className="space-y-12 pt-12 border-t border-slate-200 scroll-mt-32">
            <div className="flex items-center gap-4">
              <div className="w-2 h-10 bg-[#003882] rounded-full"></div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-[#003882]">Downloads</h2>
            </div>
            <div className="grid grid-cols-1 gap-6">
              {lesson.attachments?.map((att, i) => (
                <div key={i} className="bg-white rounded-[40px] p-8 flex items-center justify-between border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden">
                  <div className="flex items-center gap-6 min-w-0 flex-1">
                    <div className="bg-slate-50 p-4 rounded-3xl text-slate-400 group-hover:bg-pink-50 group-hover:text-[#EF4E92] transition-colors shrink-0">
                      <FileText size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-slate-800 text-base truncate pr-4">{att.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Resource Item</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button 
                      onClick={() => setViewingResource(att)} 
                      className="p-3 md:p-4 bg-slate-50 text-[#EF4E92] rounded-2xl hover:bg-pink-50 transition-all active:scale-95 border border-pink-100"
                      title="View in App"
                    >
                      <Eye size={20} />
                    </button>
                    <button 
                      onClick={() => handleDownload(att.storage_path, att.name)} 
                      className="p-3 md:p-4 bg-blue-50 text-[#003882] rounded-2xl hover:bg-blue-100 transition-all active:scale-95 border border-blue-100"
                      title="Download File"
                    >
                      <Download size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default LessonDetail;
