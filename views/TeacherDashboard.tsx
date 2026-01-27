
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/supabaseService.ts';
import { Lesson, UserRole, Profile, LessonContentStructure, LessonOccurrence, PlannerConfig } from '../types.ts';
import { 
  X, ArrowLeft, ChevronRight, Download, BookOpen, GraduationCap, Users, 
  Calendar, LogOut, Clock, Database, RefreshCw, Zap
} from 'lucide-react';
import TTSController from '../components/TTSController.tsx';

interface TeacherDashboardProps {
  user: Profile;
  onLogout: () => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, onLogout }) => {
  const [nextOccurrence, setNextOccurrence] = useState<LessonOccurrence | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingResource, setViewingResource] = useState<any>(null);
  const [activeReadingId, setActiveReadingId] = useState<string | null>(null);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [error, setError] = useState<{message: string, isSchema: boolean} | null>(null);

  useEffect(() => {
    fetchNextMission();
    
    // Refresh check on focus
    window.addEventListener('focus', fetchNextMission);
    return () => window.removeEventListener('focus', fetchNextMission);
  }, []);

  const fetchNextMission = async () => {
    setLoading(true);
    setError(null);
    try {
      // For this demo, we use 'HISTORY' as the default mission category
      const occ = await db.plannerOccurrences.getNextForTeacher('HISTORY');
      setNextOccurrence(occ);
    } catch (e: any) { 
      console.error("Fetch Mission Error:", e);
      setError({ message: e.message, isSchema: false });
    } finally { 
      setLoading(false); 
    }
  };

  const handleViewLesson = async () => {
    if (!nextOccurrence?.lesson_id) return;
    setLoading(true);
    try {
      const full = await db.lessons.get(nextOccurrence.lesson_id);
      setSelectedLesson(full);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) { 
      alert("Error loading mission details."); 
    } finally { 
      setLoading(false); 
    }
  };

  const parseMarkdownToStructure = (md: string): LessonContentStructure => {
    const newStructure: LessonContentStructure = { read: [], teach: [], engage: [] };
    if (!md) return newStructure;
    const mainSections = md.split(/^# \d\. /m);
    ['read', 'teach', 'engage'].forEach((key, i) => {
      const fullBlock = mainSections[i + 1] || '';
      const parts = fullBlock.split(/^## /m);
      newStructure[key as keyof LessonContentStructure] = parts.slice(1).filter(s => s.trim()).map((s, idx) => {
        const lines = s.split('\n');
        return { id: `${key}-sub-${idx}`, title: lines[0].trim(), content: lines.slice(1).join('\n').trim() };
      });
    });
    return newStructure;
  };

  const lessonStructure = selectedLesson ? parseMarkdownToStructure(selectedLesson.content || '') : null;
  const ttsSections = useMemo(() => {
    if (!lessonStructure) return [];
    return [
      { id: 'read-sec', title: 'READ', subsections: lessonStructure.read },
      { id: 'teach-sec', title: 'TEACH', subsections: lessonStructure.teach },
      { id: 'engage-sec', title: 'ENGAGE', subsections: lessonStructure.engage }
    ];
  }, [lessonStructure]);

  return (
    <div className="min-h-screen bg-[#F4F7FA] text-slate-900 font-sans selection:bg-pink-100 flex flex-col overflow-x-hidden">
      {selectedLesson && <TTSController sections={ttsSections} onActiveIdChange={setActiveReadingId} onPlayingStatusChange={setIsTTSPlaying} />}

      {/* HEADER */}
      {!selectedLesson && (
        <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-[#EF4E92] w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-xl">K</div>
              <div className="hidden sm:block">
                <span className="font-black text-2xl tracking-tighter text-[#003882] uppercase block leading-none">Faith Pathway</span>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">Teacher Dashboard</span>
              </div>
            </div>
            <button onClick={onLogout} className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 tracking-widest flex items-center gap-2 p-2 px-4 rounded-xl transition-all border border-slate-50 hover:bg-slate-50 shadow-sm"><LogOut size={16} /> LOGOUT</button>
          </div>
        </header>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 min-w-0">
        {!selectedLesson ? (
          <div className="max-w-4xl mx-auto p-6 md:p-10 animate-in fade-in duration-700">
            <div className="mb-12 space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500 w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Dynamic Mission Path</span>
              </div>
              <h1 className="text-4xl sm:text-7xl font-black text-[#003882] tracking-tighter uppercase leading-none">Current Objective</h1>
              <p className="text-slate-400 font-medium text-lg sm:text-xl max-w-2xl leading-relaxed">Your assigned lesson updates automatically based on the mission frequency rule.</p>
            </div>

            {loading ? (
              <div className="h-96 bg-white/50 rounded-[64px] animate-pulse flex items-center justify-center font-black text-slate-300 uppercase tracking-widest">
                Syncing Timeline...
              </div>
            ) : nextOccurrence ? (
              <div 
                onClick={handleViewLesson}
                className="group bg-white rounded-[64px] p-10 md:p-16 border-2 border-white shadow-2xl hover:shadow-[#EF4E92]/10 hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8">
                  <div className="bg-blue-50 text-[#003882] px-4 py-2 rounded-2xl flex items-center gap-3 font-black text-[10px] uppercase tracking-widest">
                    <Clock size={14} /> {new Date(nextOccurrence.scheduled_date).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="flex items-center gap-4">
                    <span className="bg-[#EF4E92] text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">{nextOccurrence.category}</span>
                    <div className="flex items-center gap-2 text-slate-400 font-black text-[11px] uppercase tracking-widest">
                      <Zap size={14} className="text-amber-400 fill-amber-400" /> ACTIVE SLOT
                    </div>
                  </div>

                  <h2 className="text-4xl md:text-7xl font-black text-[#003882] tracking-tighter leading-[1.1] transition-colors group-hover:text-[#EF4E92]">
                    {nextOccurrence.lesson?.title || 'Untitled Mission'}
                  </h2>
                  <p className="text-slate-500 text-xl md:text-2xl leading-relaxed font-medium italic opacity-80 line-clamp-3">
                    "{nextOccurrence.lesson?.summary || 'No briefing available.'}"
                  </p>

                  <div className="pt-10 flex items-center gap-4 text-[11px] font-black uppercase tracking-widest text-[#003882]">
                    <div className="w-12 h-12 bg-[#003882] text-white rounded-full flex items-center justify-center group-hover:bg-[#EF4E92] transition-colors shadow-xl">
                      <ChevronRight size={24} strokeWidth={3} />
                    </div>
                    Open Briefing
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center bg-white rounded-[64px] border-4 border-dashed border-slate-100 p-12 text-center space-y-8 shadow-inner">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200"><Calendar size={48} /></div>
                <div>
                  <p className="font-black uppercase tracking-[0.4em] text-[#003882] text-sm">Awaiting Deployment</p>
                  <p className="text-slate-300 font-medium mt-4 text-lg">No lesson has been assigned to the current mission cycle.<br/>Contact the administrator to assign a lesson to the current slot.</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* LESSON DETAIL VIEW */
          <div className="max-w-4xl mx-auto px-6 py-10 md:py-20 animate-in fade-in slide-in-from-bottom-6 duration-700">
             <button onClick={() => setSelectedLesson(null)} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-black mb-12"><ArrowLeft size={16} strokeWidth={3} /> Return Dashboard</button>
             <h1 className="text-5xl md:text-8xl font-black text-[#003882] tracking-tighter leading-none mb-10">{selectedLesson.title}</h1>
             <p className="text-2xl md:text-3xl text-slate-400 font-medium italic leading-relaxed mb-24 opacity-80">"{selectedLesson.summary}"</p>
             <div className="space-y-32">
                {['read', 'teach', 'engage'].map((key, i) => (
                  <section key={key} className="space-y-12">
                     <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-3xl text-white shadow-xl ${i===0?'bg-blue-600':i===1?'bg-emerald-500':'bg-pink-500'}`}>{i===0?<BookOpen size={24}/>:i===1?<GraduationCap size={24}/>:<Users size={24}/>}</div>
                        <h3 className="text-4xl font-black tracking-tighter uppercase text-[#003882]">{i+1}. {key}</h3>
                     </div>
                     <div className="space-y-8">
                        {lessonStructure && (lessonStructure as any)[key].map((section: any) => (
                          <div key={section.id} id={section.id} className={`bg-white rounded-[48px] p-10 md:p-16 border-t-[16px] transition-all duration-500 shadow-sm ${activeReadingId === section.id ? 'ring-8 ring-pink-50 border-t-[#EF4E92] scale-[1.02] shadow-2xl' : 'border-t-slate-50'}`}>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-8">{section.title}</h4>
                            <p className="text-slate-700 text-2xl md:text-3xl leading-relaxed font-medium whitespace-pre-wrap">{section.content}</p>
                          </div>
                        ))}
                     </div>
                  </section>
                ))}
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TeacherDashboard;
