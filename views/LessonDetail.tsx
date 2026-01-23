
import React, { useState, useEffect } from 'react';
import { db } from '../services/supabaseService.ts';
import { Lesson, Profile, Attachment } from '../types.ts';
import ActivityCard from '../components/ActivityCard.tsx';
import VideoEmbed from '../components/VideoEmbed.tsx';
import LessonTextTab from '../components/LessonTextTab.tsx';

interface LessonDetailProps {
  lessonId: string;
  user: Profile;
  onBack: () => void;
}

// Utility to handle Google Drive URLs
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
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'media'>('overview');
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  if (loading) return <div className="p-10 text-center animate-pulse font-black text-gray-300">Loading Masterpiece...</div>;
  if (!lesson) return <div className="p-10 text-center">Lesson not found.</div>;

  return (
    <div className="min-h-screen bg-white">
      {/* PREVIEW MODAL */}
      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full h-full max-w-6xl rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col">
            <div className="p-6 flex items-center justify-between border-b border-gray-100">
              <h3 className="font-black text-xs uppercase tracking-widest text-gray-400">Resource Preview</h3>
              <button 
                onClick={() => setPreviewUrl(null)} 
                className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-[#EF4E92] hover:text-white transition-all shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 bg-gray-50">
              <iframe 
                src={previewUrl} 
                className="w-full h-full border-none" 
                allow="autoplay"
                title="Document Preview"
              />
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 bg-white border-b border-gray-50 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="text-center px-4 overflow-hidden">
          <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-gray-400 truncate">{lesson.category} • {lesson.series}</p>
          <h1 className="text-xs md:text-sm font-black truncate text-gray-900">{lesson.title}</h1>
        </div>
        <button 
          onClick={toggleComplete}
          className={`shrink-0 flex items-center gap-2 px-4 md:px-8 py-2 md:py-3 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${
            completed ? 'bg-green-500 text-white shadow-lg' : 'bg-[#EF4E92] text-white shadow-lg shadow-[#EF4E92]/20'
          }`}
        >
          {completed ? (
            <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> Done</>
          ) : (
            'Complete'
          )}
        </button>
      </header>

      <main className="max-w-6xl mx-auto">
        {/* Sticky Tab Navigation Bar */}
        <div className="sticky top-[57px] md:top-[73px] z-40 bg-white border-b border-gray-100 px-6 py-2 md:py-4 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-4 md:gap-8">
          {(['overview', 'activities', 'media'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 md:pb-3 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] transition-all border-b-2 ${
                activeTab === tab ? 'border-[#EF4E92] text-[#EF4E92]' : 'border-transparent text-gray-400 hover:text-black'
              }`}
            >
              {tab === 'media' ? 'Resources' : tab}
            </button>
          ))}
        </div>

        <div className="px-6 py-8 md:py-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
          {activeTab === 'overview' && (
            <div className="space-y-16">
              <section className="max-w-4xl mx-auto space-y-6">
                <h2 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tighter leading-tight">{lesson.title}</h2>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-gray-100 px-4 py-1.5 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-widest">Grades {lesson.grade_min}-{lesson.grade_max}</span>
                  <span className="bg-pink-50 px-4 py-1.5 rounded-full text-[10px] font-black text-[#EF4E92] uppercase tracking-widest">{lesson.category}</span>
                </div>
              </section>

              <div className="border-t border-gray-50 pt-16">
                <LessonTextTab content={lesson.content} />
              </div>
            </div>
          )}

          {activeTab === 'activities' && (
            <div className="max-w-4xl mx-auto space-y-8 md:space-y-12">
              {lesson.activities?.length ? (
                lesson.activities.map(activity => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))
              ) : (
                <div className="text-center py-24 bg-gray-50 rounded-[48px] text-gray-400 font-bold uppercase tracking-widest text-xs">No active activities for this lesson.</div>
              )}
            </div>
          )}

          {activeTab === 'media' && (
            <div className="max-w-4xl mx-auto space-y-16">
              <section className="space-y-8">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-[#EF4E92] rounded-full"></div>
                  <h3 className="text-xl font-black uppercase text-gray-900 tracking-tight">Lesson Videos</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {lesson.videos?.length ? (
                    lesson.videos.map(video => (
                      <div key={video.id} className="space-y-4 bg-gray-50 p-6 rounded-[32px]">
                        <h4 className="font-black text-sm text-gray-800 uppercase tracking-wide">{video.title || 'Instructional Video'}</h4>
                        <VideoEmbed url={video.url} />
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 font-medium col-span-full py-10 text-center">No video resources available.</p>
                  )}
                </div>
              </section>

              <section className="space-y-8">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-gray-900 rounded-full"></div>
                  <h3 className="text-xl font-black uppercase text-gray-900 tracking-tight">Handouts & Downloads</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {lesson.attachments?.length ? (
                    lesson.attachments.map(att => {
                      const driveLinks = getGoogleDriveLinks(att.storage_path);
                      return (
                        <div 
                          key={att.id}
                          className="p-6 bg-white border border-gray-100 rounded-[32px] flex items-center justify-between hover:border-[#EF4E92] transition-all shadow-sm group"
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <p className="font-black text-sm truncate text-gray-900 uppercase tracking-wide">{att.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{att.type || 'DOCUMENT'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* VIEW BUTTON */}
                            <button 
                              onClick={() => setPreviewUrl(driveLinks?.preview || att.storage_path)}
                              className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-[#EF4E92] hover:text-white transition-all shadow-sm"
                              title="View & Print"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                            {/* DOWNLOAD BUTTON */}
                            <a 
                              href={driveLinks?.download || att.storage_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-[#EF4E92] hover:text-white transition-all shadow-sm"
                              title="Download"
                              download
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </a>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full py-12 border-2 border-dashed border-gray-100 rounded-[40px] text-center text-gray-300 font-black text-[10px] uppercase tracking-widest">No downloadable materials</div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default LessonDetail;
