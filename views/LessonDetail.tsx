
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseMock';
import { Lesson, UserRole, Profile } from '../types';
import ActivityCard from '../components/ActivityCard';
import VideoEmbed from '../components/VideoEmbed';

interface LessonDetailProps {
  lessonId: string;
  user: Profile;
  onBack: () => void;
}

const LessonDetail: React.FC<LessonDetailProps> = ({ lessonId, user, onBack }) => {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [completed, setCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'text' | 'activities' | 'media'>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const data = await supabase.lessons.get(lessonId);
      setLesson(data);
      
      const prog = await supabase.progress.get(lessonId, user.id);
      setCompleted(prog?.completed || false);
      
      setLoading(false);
    };
    fetch();
  }, [lessonId, user.id]);

  const toggleComplete = async () => {
    await supabase.progress.toggle(lessonId, user.id);
    setCompleted(!completed);
  };

  if (loading) return <div className="p-10 text-center">Loading Lesson...</div>;
  if (!lesson) return <div className="p-10 text-center">Lesson not found.</div>;

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Reader Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center hidden md:block">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{lesson.category} • {lesson.series}</p>
          <h1 className="text-sm font-bold">{lesson.title}</h1>
        </div>
        <button 
          onClick={toggleComplete}
          className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold transition-all ${
            completed ? 'bg-green-500 text-white shadow-lg shadow-green-100' : 'bg-pink-500 text-white shadow-lg shadow-pink-100'
          }`}
        >
          {completed ? (
            <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> Completed</>
          ) : (
            'Mark Complete'
          )}
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-100 mb-10 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {(['overview', 'text', 'activities', 'media'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 text-sm font-bold capitalize transition-all border-b-2 ${
                activeTab === tab ? 'border-pink-500 text-pink-500' : 'border-transparent text-gray-400 hover:text-black'
              }`}
            >
              {tab === 'media' ? 'Videos & Files' : tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'overview' && (
            <div className="space-y-10">
              <section>
                <h2 className="text-3xl font-black mb-4">{lesson.title}</h2>
                <div className="flex flex-wrap gap-4 mb-8">
                  <span className="bg-gray-50 px-3 py-1 rounded text-xs font-bold text-gray-500 uppercase">Grades {lesson.grade_min}-{lesson.grade_max}</span>
                  <span className="bg-gray-50 px-3 py-1 rounded text-xs font-bold text-gray-500 uppercase">{lesson.category}</span>
                </div>
                <p className="text-xl text-gray-600 leading-relaxed font-light italic border-l-4 border-pink-500 pl-6 py-2">
                  {lesson.summary}
                </p>
              </section>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-pink-50 p-6 rounded-3xl">
                  <h3 className="font-bold text-pink-600 mb-2 uppercase text-xs tracking-widest">Key Learning</h3>
                  <p className="text-gray-700">Explore the main themes of this week's story through guided reading and creative crafts.</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-3xl">
                  <h3 className="font-bold text-gray-600 mb-2 uppercase text-xs tracking-widest">At a Glance</h3>
                  <ul className="text-sm space-y-1 text-gray-500">
                    <li>⏱️ 45-60 minutes total</li>
                    <li>🎨 1 Hands-on activity</li>
                    <li>📺 1 Video summary</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'text' && (
            <article className="prose prose-pink max-w-none">
              <div className="text-gray-800 leading-loose text-lg whitespace-pre-wrap">
                {lesson.content}
              </div>
            </article>
          )}

          {activeTab === 'activities' && (
            <div className="space-y-8">
              {lesson.activities?.length ? (
                lesson.activities.map(activity => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))
              ) : (
                <div className="text-center py-20 text-gray-400">No activities listed for this lesson.</div>
              )}
            </div>
          )}

          {activeTab === 'media' && (
            <div className="space-y-12">
              <section>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-pink-500 rounded-full"></span>
                  Videos
                </h3>
                <div className="space-y-8">
                  {lesson.videos?.length ? (
                    lesson.videos.map(video => (
                      <div key={video.id}>
                        <h4 className="font-semibold mb-3">{video.title}</h4>
                        <VideoEmbed url={video.url} />
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 italic">No videos attached.</p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-gray-900 rounded-full"></span>
                  Attachments
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lesson.attachments?.length ? (
                    lesson.attachments.map(att => (
                      <a 
                        key={att.id}
                        href={supabase.storage.getPublicUrl(att.storage_path)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-4 bg-white border border-gray-100 rounded-2xl flex items-center gap-4 hover:border-pink-500 transition-colors shadow-sm"
                      >
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{att.name}</p>
                          <p className="text-[10px] text-gray-400 uppercase font-bold">{att.type}</p>
                        </div>
                      </a>
                    ))
                  ) : (
                    <p className="col-span-full text-gray-400 italic">No downloadable files attached.</p>
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
