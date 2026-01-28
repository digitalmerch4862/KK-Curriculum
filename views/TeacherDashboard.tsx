
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/supabaseService.ts';
import { Lesson, UserRole, Profile, LessonContentStructure, LessonVideo, Attachment, LessonSchedule } from '../types.ts';
import { 
  X, ArrowLeft, ChevronRight, Menu, Download, FileText, Play, Eye, Search, BookOpen, GraduationCap, Users, CheckCircle2,
  LayoutGrid, Book, History, Music, ScrollText, Cross, Send, Globe, LogOut, Video, AlertCircle
} from 'lucide-react';
import TTSController from '../components/TTSController.tsx';

interface TeacherDashboardProps {
  user: Profile;
  onLogout: () => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, onLogout }) => {
  const [scheduledLesson, setScheduledLesson] = useState<Lesson | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const [activeVideo, setActiveVideo] = useState<LessonVideo | null>(null);
  const [viewingResource, setViewingResource] = useState<Attachment | null>(null);

  // Videoke Mode State
  const [activeReadingId, setActiveReadingId] = useState<string | null>(null);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);

  useEffect(() => {
    fetchDailyMission();
  }, []);

  /**
   * Determine the effective date based on the 1 AM Europe/London reset rule.
   */
  const getLondonEffectiveDate = () => {
    const now = new Date();
    
    // Get London time components
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: 'numeric',
      hour12: false,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const parts = formatter.formatToParts(now);
    const findPart = (type: string) => parts.find(p => p.type === type)?.value;
    
    const hour = parseInt(findPart('hour') || '0', 10);
    const year = findPart('year');
    const month = findPart('month')?.padStart(2, '0');
    const day = findPart('day')?.padStart(2, '0');
    
    // We treat hours < 1 as "yesterday"
    const londonBaseDate = new Date(`${year}-${month}-${day}T00:00:00Z`); // Using UTC as a buffer to avoid local interference
    
    if (hour < 1) {
      londonBaseDate.setUTCDate(londonBaseDate.getUTCDate() - 1);
    }
    
    const y = londonBaseDate.getUTCFullYear();
    const m = (londonBaseDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = londonBaseDate.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const fetchDailyMission = async () => {
    setLoading(true);
    try {
      const dateStr = getLondonEffectiveDate();
      const schedule = await db.schedules.getForDate(dateStr);
      if (schedule && schedule.lesson) {
        setScheduledLesson(schedule.lesson);
      } else {
        setScheduledLesson(null);
      }
    } catch (e) { 
      console.error("Error fetching daily mission", e); 
    } finally { 
      setLoading(false); 
    }
  };

  const getLessonThumbnail = (lesson: Lesson) => {
    if (!lesson.videos || lesson.videos.length === 0) return null;
    const url = lesson.videos[0].url;
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
        const videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
      if (urlObj.hostname.includes('vimeo.com')) {
        return `https://vumbnail.com/${url.split('/').pop()}.jpg`;
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  const handleViewLesson = async (id: string) => {
    setLoading(true);
    try {
      const full = await db.lessons.get(id);
      setSelectedLesson(full);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { 
      alert("Error loading lesson details."); 
    } finally { 
      setLoading(false); 
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
      setIsNavExpanded(false);
    }
  };

  const parseMarkdownToStructure = (md: string): LessonContentStructure => {
    const newStructure: LessonContentStructure = { read: [], teach: [], engage: [] };
    if (!md) return newStructure;
    
    const mainSections = md.split(/^# \d\. /m);
    const pillars = ['read', 'teach', 'engage'] as const;
    pillars.forEach((key, i) => {
      const fullBlock = mainSections[i + 1] || '';
      const parts = fullBlock.split(/^## /m);
      newStructure[key] = parts.slice(1).filter(s => s.trim()).map((s, idx) => {
        const lines = s.split('\n');
        return {
          id: `${key}-sub-${idx}`,
          title: lines[0].trim(),
          content: lines.slice(1).join('\n').trim()
        };
      });
    });
    return newStructure;
  };

  const getViewableUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
      const match = url.match(/\/d\/([^\/]+)/) || url.match(/id=([^&]+)/);
      const fileId = match ? match[1] : null;
      if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    return url;
  };

  const handleDownload = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, '_blank');
  };

  const handlePreviewOpen = (e: React.MouseEvent, att: Attachment) => {
    e.stopPropagation();
    setViewingResource(att);
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
      
      {/* --- VIDEOKE CONTROL --- */}
      {selectedLesson && (
        <TTSController 
          sections={ttsSections}
          onActiveIdChange={setActiveReadingId}
          onPlayingStatusChange={setIsTTSPlaying}
        />
      )}

      {/* --- RESOURCE PREVIEW MODAL --- */}
      {viewingResource && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/95 backdrop-blur-md p-0 sm:p-6 overflow-hidden">
          <div className="bg-white w-full h-full sm:max-w-6xl sm:h-[90vh] sm:rounded-[40px] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="px-4 py-4 sm:px-8 sm:py-6 border-b flex items-center justify-between bg-white sticky top-0 z-[210]">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="text-[#EF4E92] shrink-0" size={24} />
                <h3 className="font-black text-sm sm:text-xl truncate text-[#003882]">{viewingResource.name}</h3>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={(e) => handleDownload(e, viewingResource.storage_path)} 
                  className="bg-[#003882] text-white p-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#002b66] active:scale-95 transition-all shadow-lg"
                >
                  <Download size={16} /> <span className="hidden sm:inline">Download</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setViewingResource(null)} 
                  className="p-2 sm:p-3 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-900 active:scale-90"
                >
                  <X size={24} strokeWidth={3} />
                </button>
              </div>
            </div>
            <div className="flex-1 w-full bg-slate-50 relative overflow-hidden">
              <iframe 
                src={getViewableUrl(viewingResource.storage_path)} 
                className="w-full h-full border-none bg-white touch-auto" 
                title="Resource Preview" 
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-[#EF4E92] w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-lg">K</div>
          <span className="font-black text-xl tracking-tighter text-[#003882] uppercase">Mission Command</span>
        </div>
        <button onClick={onLogout} className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 tracking-widest flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-red-50 transition-all">
          <LogOut size={16} /> LOGOUT
        </button>
      </header>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 p-5 sm:p-8 md:p-12">
        {!selectedLesson ? (
          <div className="max-w-5xl mx-auto animate-in fade-in duration-700">
            <div className="mb-12">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#003882] tracking-tighter uppercase mb-2">
                Today's Mission
              </h1>
              <p className="text-slate-400 font-medium text-sm sm:text-base">Ready for deployment. The mission briefing resets daily at 01:00 AM (London Time).</p>
            </div>

            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#EF4E92] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : scheduledLesson ? (
              <div 
                onClick={() => handleViewLesson(scheduledLesson.id)}
                className="group bg-white rounded-[48px] border border-slate-50 shadow-sm hover:shadow-2xl hover:scale-[1.01] transition-all cursor-pointer flex flex-col md:flex-row overflow-hidden min-h-[400px]"
              >
                {/* Visual Section */}
                <div className="w-full md:w-1/2 h-64 md:h-auto relative bg-slate-100">
                  {getLessonThumbnail(scheduledLesson) ? (
                    <img 
                      src={getLessonThumbnail(scheduledLesson)!} 
                      alt={scheduledLesson.title} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#003882] to-[#EF4E92]/20">
                      <BookOpen size={64} className="text-white/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                      <Play fill="currentColor" size={24} />
                    </div>
                  </div>
                </div>

                {/* Content Section */}
                <div className="w-full md:w-1/2 p-10 md:p-14 flex flex-col justify-center">
                  <span className="bg-[#EF4E92] text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg inline-block w-fit mb-6">
                    {scheduledLesson.category}
                  </span>
                  <h2 className="text-3xl md:text-5xl font-black text-[#003882] mb-6 group-hover:text-[#EF4E92] leading-none tracking-tighter transition-colors">
                    {scheduledLesson.title}
                  </h2>
                  <p className="text-slate-500 text-lg leading-relaxed mb-8 italic">
                    {scheduledLesson.summary}
                  </p>
                  <div className="pt-8 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Target Grades</span>
                        <span className="text-lg font-black text-[#003882]">{scheduledLesson.grade_min} - {scheduledLesson.grade_max}</span>
                      </div>
                    </div>
                    <div className="bg-[#003882] text-white p-4 rounded-3xl group-hover:bg-[#EF4E92] transition-colors shadow-lg">
                      <ChevronRight size={24} strokeWidth={3} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[48px] p-16 md:p-24 border-2 border-dashed border-slate-200 text-center flex flex-col items-center gap-6">
                <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center text-[#EF4E92]">
                  <AlertCircle size={40} />
                </div>
                <div className="max-w-md">
                  <h3 className="text-2xl font-black text-[#003882] uppercase tracking-tight mb-2">No Mission Assigned</h3>
                  <p className="text-slate-400 font-medium mb-8 leading-relaxed">There is no lesson assigned for your command on this date sector.</p>
                  <div className="bg-pink-50 border border-pink-100 rounded-[32px] p-8">
                    <p className="text-[#EF4E92] font-black uppercase text-[11px] tracking-widest leading-relaxed">
                      Notice: No lesson scheduled. Please contact your admin to set the lesson.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* --- SELECTED LESSON VIEW --- */
          <div className="max-w-4xl mx-auto px-5 sm:px-6 py-10 sm:py-20 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Floating Navigation Map */}
            {lessonStructure && (
              <div className="fixed bottom-6 right-6 z-[70] flex flex-col items-end gap-3 pointer-events-none">
                <div className={`
                  flex flex-col gap-2 mb-2 transition-all duration-300 origin-bottom-right max-h-[50vh] overflow-y-auto pr-1 scrollbar-hide pointer-events-auto
                  ${isNavExpanded ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}
                `}>
                  <button onClick={() => setSelectedLesson(null)} className="bg-slate-900 text-white px-5 sm:px-6 py-3 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 self-end">
                    <ArrowLeft size={14} /> Exit Mission
                  </button>
                  <div className="w-px h-4 bg-slate-200 self-end mr-6"></div>
                  {lessonStructure.read.map(item => (
                    <button key={item.id} onClick={() => scrollToSection(item.id)} className="bg-[#2563eb] text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg text-right hover:scale-105 transition-all">{item.title}</button>
                  ))}
                  {lessonStructure.teach.map(item => (
                    <button key={item.id} onClick={() => scrollToSection(item.id)} className="bg-[#10b981] text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg text-right hover:scale-105 transition-all">{item.title}</button>
                  ))}
                  {lessonStructure.engage.map(item => (
                    <button key={item.id} onClick={() => scrollToSection(item.id)} className="bg-[#EF4E92] text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg text-right hover:scale-105 transition-all">{item.title}</button>
                  ))}
                </div>
                <button 
                  onClick={() => setIsNavExpanded(!isNavExpanded)} 
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 pointer-events-auto ${isNavExpanded ? 'bg-slate-900 text-white rotate-90' : 'bg-[#EF4E92] text-white'}`}
                >
                  {isNavExpanded ? <X size={24} strokeWidth={3} /> : <Menu size={24} strokeWidth={3} />}
                </button>
              </div>
            )}

            <div className="mb-12 sm:mb-20">
              <div className="flex items-center gap-3 mb-6 sm:mb-8">
                <button onClick={() => setSelectedLesson(null)} className="p-2.5 sm:p-3 bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all active:scale-95">
                  <ArrowLeft size={20} />
                </button>
                <span className="bg-[#EF4E92] text-white px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-md inline-block">{selectedLesson.category}</span>
              </div>
              <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-[#003882] tracking-tighter mt-4 leading-[1.1] mb-6">{selectedLesson.title}</h1>
              <p className="text-lg sm:text-xl md:text-2xl text-slate-400 font-medium italic leading-relaxed">"{selectedLesson.summary}"</p>
            </div>

            <div className="space-y-24 sm:space-y-32">
              {[
                { id: 'read-anchor', key: 'read', color: '#2563eb', label: '1. READ', icon: <BookOpen size={24} /> },
                { id: 'teach-anchor', key: 'teach', color: '#10b981', label: '2. TEACH', icon: <GraduationCap size={24} /> },
                { id: 'engage-anchor', key: 'engage', color: '#EF4E92', label: '3. ENGAGE', icon: <Users size={24} /> }
              ].map((pillar) => (
                <section key={pillar.key} id={pillar.id} className="scroll-mt-24">
                  <div className="flex items-center gap-4 mb-8 sm:mb-12">
                    <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-white shadow-lg" style={{ backgroundColor: pillar.color }}>
                      {React.cloneElement(pillar.icon as React.ReactElement<any>, { size: 20 })}
                    </div>
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter uppercase text-[#003882]">{pillar.label}</h3>
                  </div>
                  <div className="flex flex-col gap-6 sm:gap-10">
                    {lessonStructure && (lessonStructure as any)[pillar.key].map((section: any) => (
                      <div 
                        key={section.id} 
                        id={section.id}
                        className={`bg-white rounded-[32px] sm:rounded-[40px] p-6 sm:p-8 md:p-12 shadow-sm border-t-[8px] sm:border-t-[12px] scroll-mt-28 transition-all duration-500 ${
                          activeReadingId === section.id 
                          ? 'scale-[1.01] ring-4 sm:ring-8 ring-pink-50 shadow-2xl border-t-[#EF4E92]' 
                          : 'hover:shadow-xl'
                        }`} 
                        style={{ borderTopColor: activeReadingId === section.id ? '#EF4E92' : pillar.color }}
                      >
                        <div className="flex items-center justify-between mb-6 sm:mb-8">
                          <h4 className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest">{section.title}</h4>
                          <CheckCircle2 className={`transition-all ${activeReadingId === section.id ? 'text-[#EF4E92] scale-125' : 'text-slate-50'}`} size={20} />
                        </div>
                        <p className="text-slate-700 text-base sm:text-xl md:text-2xl leading-relaxed font-medium whitespace-pre-wrap">{section.content}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Media HUB */}
            <section id="media-hub" className="mt-24 sm:mt-40 scroll-mt-24">
              <div className="flex items-center gap-3 mb-8 sm:mb-12">
                <div className="h-8 sm:h-10 w-1.5 sm:w-2 bg-slate-800 rounded-full"></div>
                <h3 className="text-2xl sm:text-3xl font-black text-[#003882] uppercase tracking-tighter">Media Hub</h3>
              </div>
              <div className="flex flex-col gap-6 sm:gap-10">
                {selectedLesson.videos?.map((vid, i) => (
                  <div key={i} className="bg-slate-900 rounded-[32px] sm:rounded-[48px] overflow-hidden aspect-video shadow-2xl relative border-2 sm:border-4 border-white">
                    {activeVideo?.url === vid.url ? (
                      <iframe src={`https://www.youtube.com/embed/${vid.url.includes('v=') ? vid.url.split('v=')[1].split('&')[0] : vid.url.split('/').pop()}`} className="w-full h-full" allowFullScreen allow="autoplay" title={vid.title || 'Lesson Video'} />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 sm:p-8 bg-slate-800 relative group">
                        <button onClick={() => setActiveVideo(vid)} className="w-16 h-16 sm:w-24 sm:h-24 bg-white text-slate-900 rounded-full flex items-center justify-center sm:hover:scale-110 active:scale-95 transition-all shadow-2xl relative z-10">
                          <Play fill="currentColor" size={24} className="sm:scale-125" />
                        </button>
                        <span className="text-white/60 font-black mt-6 sm:mt-8 uppercase text-[9px] sm:text-[11px] tracking-widest relative z-10">{vid.title || 'Play Lesson Media'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Resources HUB */}
            <section id="resource-hub" className="mt-24 sm:mt-40 scroll-mt-24 pb-40">
              <div className="flex items-center gap-3 mb-8 sm:mb-12">
                <div className="h-8 sm:h-10 w-1.5 sm:w-2 bg-[#003882] rounded-full"></div>
                <h3 className="text-2xl sm:text-3xl font-black text-[#003882] uppercase tracking-tighter">Resources</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:gap-6">
                {selectedLesson.attachments?.map((att, i) => (
                  <div key={i} className="bg-white rounded-[24px] sm:rounded-[40px] p-4 sm:p-6 md:p-8 flex items-center justify-between border border-slate-100 shadow-sm sm:hover:shadow-xl transition-all group relative overflow-visible z-10">
                    <div className="flex items-center gap-3 sm:gap-6 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-slate-800 text-xs sm:text-base truncate pr-2" title={att.name}>{att.name}</h4>
                        <p className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ready to access</p>
                      </div>
                    </div>
                    <div className="flex gap-2 sm:gap-3 shrink-0 ml-4 relative z-20">
                      <button 
                        type="button"
                        onClick={(e) => handlePreviewOpen(e, att)}
                        className="p-3 sm:p-4 bg-slate-50 text-[#EF4E92] rounded-xl sm:rounded-2xl sm:hover:bg-pink-50 transition-all active:scale-90 border border-pink-100 shadow-sm cursor-pointer"
                        title="View in App"
                      >
                        <Eye size={20} />
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => handleDownload(e, att.storage_path)} 
                        className="p-3 sm:p-4 bg-blue-50 text-[#003882] rounded-xl sm:rounded-2xl sm:hover:bg-blue-100 transition-all active:scale-90 border border-blue-100 shadow-sm cursor-pointer"
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
        )}
      </main>
    </div>
  );
};

export default TeacherDashboard;
