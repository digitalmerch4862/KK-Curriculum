
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/supabaseService.ts';
import { Lesson, UserRole, Profile, LessonContentStructure, LessonVideo, Attachment, LessonSchedule } from '../types.ts';
import { 
  X, ArrowLeft, ChevronRight, Menu, Download, FileText, Play, Eye, Search, BookOpen, GraduationCap, Users, CheckCircle2,
  LayoutGrid, Book, History, Music, ScrollText, Cross, Send, Globe, LogOut, Video, Clock, AlertTriangle
} from 'lucide-react';
import TTSController from '../components/TTSController.tsx';

const TeacherDashboard: React.FC<{ user: Profile; onLogout: () => void }> = ({ user, onLogout }) => {
  const [scheduledLesson, setScheduledLesson] = useState<Lesson | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<LessonVideo | null>(null);
  const [viewingResource, setViewingResource] = useState<Attachment | null>(null);
  const [activeReadingId, setActiveReadingId] = useState<string | null>(null);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);

  useEffect(() => {
    fetchScheduledMission();
  }, []);

  const fetchScheduledMission = async () => {
    setLoading(true);
    try {
      const now = new Date();
      // If time is before 1 AM, we look at the previous date's mission?
      // User says "reset every next day at 1am".
      // Usually means the "current mission" lasts from 1am today until 1am tomorrow.
      
      let effectiveDate = new Date();
      if (now.getHours() < 1) {
        effectiveDate.setDate(now.getDate() - 1);
      }
      
      const dateString = effectiveDate.toISOString().split('T')[0];
      const schedule = await db.schedules.getForDate(dateString);
      
      if (schedule && schedule.lesson_id) {
        const full = await db.lessons.get(schedule.lesson_id);
        setScheduledLesson(full);
      } else {
        setScheduledLesson(null);
      }
    } catch (e) {
      console.error("Error fetching scheduled mission", e);
    } finally {
      setLoading(false);
    }
  };

  const handleViewLesson = async (id: string) => {
    setLoading(true);
    try {
      const full = await db.lessons.get(id);
      setSelectedLesson(full);
      setIsNavExpanded(false);
      setIsMobileMenuOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { alert("Error loading lesson details."); }
    finally { setLoading(false); }
  };

  const parseMarkdownToStructure = (md: string): LessonContentStructure => {
    const newStructure: LessonContentStructure = { read: [], teach: [], engage: [] };
    if (!md) return newStructure;
    const mainSections = md.split(/^# \d\. /m);
    ['read', 'teach', 'engage'].forEach((key, i) => {
      const fullBlock = mainSections[i + 1] || '';
      const parts = fullBlock.split(/^## /m);
      (newStructure as any)[key] = parts.slice(1).filter(s => s.trim()).map((s, idx) => {
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

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FA] text-slate-900 font-sans flex flex-col md:flex-row overflow-x-hidden">
      {selectedLesson && <TTSController sections={ttsSections} onActiveIdChange={setActiveReadingId} onPlayingStatusChange={setIsTTSPlaying} />}

      {/* Resource Modal - Condensed Logic */}
      {viewingResource && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/95 backdrop-blur-md p-6">
          <div className="bg-white w-full h-full max-w-6xl rounded-[40px] overflow-hidden flex flex-col shadow-2xl">
            <div className="px-8 py-6 border-b flex items-center justify-between">
              <h3 className="font-black text-xl text-[#003882]">{viewingResource.name}</h3>
              <button onClick={() => setViewingResource(null)} className="p-3 hover:bg-slate-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            <iframe src={viewingResource.storage_path} className="flex-1 w-full border-none" title="Preview" />
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 h-full overflow-y-auto">
        {!selectedLesson ? (
          <div className="p-8 md:p-12 animate-in fade-in duration-700">
            <header className="flex items-center justify-between mb-16">
              <div className="flex items-center gap-4">
                <div className="bg-[#EF4E92] w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-lg">K</div>
                <div>
                  <h1 className="text-sm font-black text-slate-300 uppercase tracking-widest">Mission Center</h1>
                  <p className="font-black text-xl text-[#003882] uppercase tracking-tighter">Assigned Deployment</p>
                </div>
              </div>
              <button onClick={onLogout} className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 tracking-widest px-6 py-3 rounded-2xl hover:bg-white transition-all">Logout</button>
            </header>

            {!scheduledLesson ? (
              <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-[64px] p-16 border-4 border-dashed border-slate-100 text-center space-y-8 shadow-sm">
                  <div className="w-24 h-24 bg-pink-50 text-[#EF4E92] rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <AlertTriangle size={48} />
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black text-[#003882] tracking-tighter uppercase leading-tight">No Mission Assigned</h2>
                  <p className="text-slate-400 font-medium text-lg max-w-lg mx-auto">Please contact your administrator to set today's flight plan. Missions reset daily at <span className="text-[#EF4E92] font-black">01:00 AM</span>.</p>
                  <div className="pt-8">
                    <button onClick={fetchScheduledMission} className="bg-[#003882] text-white px-10 py-5 rounded-full text-xs font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">Refresh Sync</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto space-y-12">
                <div className="flex items-center gap-6">
                  <div className="bg-[#003882] text-white px-6 py-3 rounded-2xl flex items-center gap-3 shadow-xl">
                    <Clock size={18} className="text-[#EF4E92]" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Active Mission for Today</span>
                  </div>
                </div>

                <div 
                  onClick={() => handleViewLesson(scheduledLesson.id)} 
                  className="group bg-white rounded-[64px] border border-slate-100 shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all cursor-pointer overflow-hidden flex flex-col md:flex-row min-h-[500px]"
                >
                  <div className="w-full md:w-[400px] bg-slate-100 relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#003882] to-[#EF4E92]/20 flex items-center justify-center text-white/20">
                      <GraduationCap size={120} strokeWidth={1} />
                    </div>
                    <div className="absolute top-10 left-10 bg-[#EF4E92] text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                      {scheduledLesson.category}
                    </div>
                  </div>
                  <div className="p-16 flex flex-col justify-center flex-1 space-y-8">
                    <div className="space-y-4">
                      <h2 className="text-5xl md:text-6xl font-black text-[#003882] tracking-tighter uppercase leading-[1.1] group-hover:text-[#EF4E92] transition-colors">{scheduledLesson.title}</h2>
                      <p className="text-2xl text-slate-400 font-medium italic leading-relaxed">"{scheduledLesson.summary}"</p>
                    </div>
                    <div className="pt-10 flex items-center gap-6">
                      <button className="bg-[#EF4E92] text-white px-10 py-5 rounded-full font-black uppercase tracking-widest text-[10px] shadow-xl group-hover:scale-105 transition-all">Begin Mission</button>
                      <div className="h-px w-20 bg-slate-100"></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Grade Level {scheduledLesson.grade_min}-{scheduledLesson.grade_max}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* SINGLE LESSON VIEW - Preserving existing structure but ensuring it's for the assigned one */
          <div className="max-w-4xl mx-auto px-6 py-20 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="fixed bottom-6 right-6 z-[70] flex flex-col items-end gap-3">
              <button onClick={() => setSelectedLesson(null)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all pointer-events-auto">
                <ArrowLeft size={16} /> Exit Mission
              </button>
            </div>

            <div className="mb-20">
              <span className="bg-[#EF4E92] text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg inline-block">{selectedLesson.category}</span>
              <h1 className="text-5xl md:text-7xl font-black text-[#003882] tracking-tighter mt-8 leading-[1.1] mb-8">{selectedLesson.title}</h1>
              <p className="text-2xl md:text-3xl text-slate-400 font-medium italic leading-relaxed">"{selectedLesson.summary}"</p>
            </div>

            <div className="space-y-32">
              {['read', 'teach', 'engage'].map((pillar, pIdx) => (
                <section key={pillar}>
                  <div className="flex items-center gap-4 mb-12">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xl" style={{ backgroundColor: pIdx === 0 ? '#2563eb' : pIdx === 1 ? '#10b981' : '#EF4E92' }}>
                      {pIdx === 0 ? <BookOpen size={20} /> : pIdx === 1 ? <GraduationCap size={20} /> : <Users size={20} />}
                    </div>
                    <h3 className="text-4xl font-black text-[#003882] uppercase tracking-tighter">{pIdx + 1}. {pillar}</h3>
                  </div>
                  <div className="space-y-10">
                    {lessonStructure && (lessonStructure as any)[pillar].map((section: any) => (
                      <div key={section.id} id={section.id} className={`bg-white rounded-[40px] p-12 shadow-sm border-t-[12px] transition-all ${activeReadingId === section.id ? 'scale-[1.02] ring-8 ring-pink-50 shadow-2xl border-t-[#EF4E92]' : 'hover:shadow-xl'}`} style={{ borderTopColor: activeReadingId === section.id ? '#EF4E92' : (pIdx === 0 ? '#2563eb' : pIdx === 1 ? '#10b981' : '#EF4E92') }}>
                        <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-8">{section.title}</h4>
                        <p className="text-xl md:text-2xl text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{section.content}</p>
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
