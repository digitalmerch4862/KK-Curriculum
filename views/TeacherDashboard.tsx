
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/supabaseService.ts';
import { Lesson, UserRole, Profile, LessonContentStructure, LessonVideo, Attachment } from '../types.ts';
import { 
  X, ArrowLeft, ChevronRight, Menu, Download, FileText, Play, Eye, Search, BookOpen, GraduationCap, Users, CheckCircle2,
  LayoutGrid, Book, History, Music, ScrollText, Cross, Send, Globe, LogOut, Video
} from 'lucide-react';
import TTSController from '../components/TTSController.tsx';

interface TeacherDashboardProps {
  user: Profile;
  onLogout: () => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, onLogout }) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL MISSIONS');
  const [loading, setLoading] = useState(true);
  
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<LessonVideo | null>(null);
  const [viewingResource, setViewingResource] = useState<Attachment | null>(null);

  // Videoke Mode State
  const [activeReadingId, setActiveReadingId] = useState<string | null>(null);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const data = await db.lessons.list(UserRole.TEACHER);
      setLessons(data);
    } catch (e) { 
      console.error("Error fetching data", e); 
    } finally { 
      setLoading(false); 
    }
  };

  const getVideoThumbnail = (videos?: LessonVideo[]) => {
    if (!videos || videos.length === 0) return null;
    const url = videos[0].url;
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
      setIsNavExpanded(false);
      setIsMobileMenuOpen(false);
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

  const getDriveFileId = (url: string) => {
    if (!url) return null;
    const match = url.match(/\/d\/([^\/]+)/) || url.match(/id=([^&]+)/);
    return match ? match[1] : null;
  };

  const getViewableUrl = (url: string) => {
    if (!url) return '';
    const fileId = getDriveFileId(url);
    if (fileId && url.includes('drive.google.com')) {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    return url;
  };

  const getDownloadUrl = (url: string) => {
    if (!url) return '';
    const fileId = getDriveFileId(url);
    if (fileId && url.includes('drive.google.com')) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return url;
  };

  const handleDownload = (e: React.MouseEvent, url: string, filename: string) => {
    e.stopPropagation();
    const downloadUrl = getDownloadUrl(url);
    window.open(downloadUrl, '_blank');
  };

  const handlePreviewOpen = (e: React.MouseEvent, att: Attachment) => {
    e.stopPropagation();
    setViewingResource(att);
  };

  const filteredLessons = lessons.filter(l => 
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
    (categoryFilter === 'ALL MISSIONS' || l.category === categoryFilter)
  );

  const categories = [
    { name: 'ALL MISSIONS', icon: <LayoutGrid size={18} /> },
    { name: 'PENTATEUCH', icon: <Book size={18} /> },
    { name: 'HISTORY', icon: <History size={18} /> },
    { name: 'POETRY', icon: <Music size={18} /> },
    { name: 'THE PROPHETS', icon: <ScrollText size={18} /> },
    { name: 'THE GOSPELS', icon: <Cross size={18} /> },
    { name: 'ACTS & EPISTLES', icon: <Send size={18} /> },
    { name: 'REVELATION', icon: <Globe size={18} /> }
  ];

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
    <div className="min-h-screen bg-[#F4F7FA] text-slate-900 font-sans selection:bg-pink-100 flex flex-col md:flex-row overflow-x-hidden">
      
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
                  onClick={(e) => handleDownload(e, viewingResource.storage_path, viewingResource.name)} 
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

      {/* --- SIDEBAR NAVIGATION --- */}
      {!selectedLesson && (
        <>
          {/* Mobile Backdrop */}
          {isMobileMenuOpen && (
            <div 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300" 
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          <aside className={`
            fixed md:relative w-[280px] md:w-72 bg-white border-r border-slate-200 flex flex-col h-full md:h-screen overflow-y-auto z-50 transition-transform duration-300 ease-in-out
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}>
            <div className="p-8 border-b border-slate-100 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-[#EF4E92] w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-lg">K</div>
                <span className="font-black text-xl tracking-tighter text-[#003882] uppercase">Mission Control</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-300 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 px-4 space-y-1">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => {
                    setCategoryFilter(cat.name);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest ${
                    categoryFilter === cat.name 
                    ? 'bg-[#003882] text-white shadow-xl shadow-blue-100' 
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                  }`}
                >
                  <span className={categoryFilter === cat.name ? 'text-[#EF4E92]' : 'text-slate-300'}>{cat.icon}</span>
                  {cat.name}
                </button>
              ))}
            </nav>

            <div className="p-8 border-t border-slate-100 mt-6">
              <button onClick={onLogout} className="w-full text-[10px] font-black uppercase text-slate-400 hover:text-red-500 tracking-widest flex items-center gap-3 py-3 px-5 rounded-2xl hover:bg-red-50 transition-all">
                <LogOut size={16} /> LOGOUT
              </button>
            </div>
          </aside>
        </>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 min-w-0 h-full overflow-y-auto">
        {!selectedLesson ? (
          <div className="p-5 sm:p-8 md:p-12 animate-in fade-in duration-700">
            {/* Mobile Header Toggle */}
            <div className="md:hidden flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="bg-[#EF4E92] w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-xs">K</div>
                <span className="font-black text-[#003882] uppercase text-sm tracking-tighter">Mission Control</span>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(true)} 
                className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 active:scale-95 transition-transform"
              >
                <Menu size={20} />
              </button>
            </div>

            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-12">
              <div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#003882] tracking-tighter uppercase mb-2">
                  {categoryFilter}
                </h1>
                <p className="text-slate-400 font-medium text-sm sm:text-base">Equip yourself with biblical truth for the next generation.</p>
              </div>
              <div className="relative w-full xl:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text" 
                  placeholder="Find a mission..." 
                  className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#EF4E92] transition-all shadow-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
              {loading ? (
                Array(6).fill(0).map((_, i) => <div key={i} className="bg-white/50 h-80 rounded-[48px] animate-pulse"></div>)
              ) : (
                filteredLessons.map(lesson => {
                  const thumb = getVideoThumbnail(lesson.videos);
                  const catIcon = categories.find(c => c.name === lesson.category)?.icon || <Video size={32} />;

                  return (
                    <div 
                      key={lesson.id} 
                      onClick={() => handleViewLesson(lesson.id)} 
                      className="group bg-white rounded-[40px] border border-slate-50 shadow-sm hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer flex flex-col overflow-hidden min-h-[420px] sm:min-h-[460px]"
                    >
                      {/* Thumbnail Stage */}
                      <div className="h-44 sm:h-52 md:h-56 relative overflow-hidden bg-slate-100">
                        {thumb ? (
                          <img 
                            src={thumb} 
                            alt={lesson.title} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#003882] to-[#EF4E92]/20 text-white/20">
                            {React.cloneElement(catIcon as React.ReactElement<any>, { size: 64, strokeWidth: 1 })}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                            <Play fill="currentColor" size={24} />
                          </div>
                        </div>
                        <span className="absolute top-4 left-4 bg-[#EF4E92] text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg">
                          {lesson.category}
                        </span>
                      </div>

                      {/* Info Stage */}
                      <div className="p-6 sm:p-8 flex flex-col flex-1">
                        <h2 className="text-lg sm:text-xl font-black text-[#003882] mb-3 group-hover:text-[#EF4E92] leading-tight line-clamp-2">
                          {lesson.title}
                        </h2>
                        <p className="text-slate-500 text-xs sm:text-sm line-clamp-3 leading-relaxed mb-auto italic">
                          {lesson.summary}
                        </p>
                        <div className="pt-5 mt-5 border-t border-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Grd {lesson.grade_min}-{lesson.grade_max}</span>
                            {lesson.videos && lesson.videos.length > 0 && (
                              <div className="flex items-center gap-1 bg-blue-50 text-[#003882] px-2 py-0.5 rounded-full text-[8px] font-black uppercase">
                                <Video size={10} /> Video
                              </div>
                            )}
                          </div>
                          <ChevronRight className="text-slate-200 group-hover:text-[#EF4E92] group-hover:translate-x-1 transition-all" size={20} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {!loading && filteredLessons.length === 0 && (
                <div className="col-span-full h-80 flex flex-col items-center justify-center bg-white/50 rounded-[48px] border-2 border-dashed border-slate-200 p-6 text-center">
                  <p className="font-black uppercase tracking-widest text-slate-400 text-[10px]">No lessons found in this mission sector.</p>
                </div>
              )}
            </div>
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
            <section id="resource-hub" className="mt-24 sm:mt-40 scroll-mt-24 pb-40 sm:pb-80">
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
                        onClick={(e) => handleDownload(e, att.storage_path, att.name)} 
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
