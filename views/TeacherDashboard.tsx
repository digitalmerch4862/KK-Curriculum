import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/supabaseService.ts';
import { Lesson, UserRole, Profile, LessonContentStructure, LessonVideo, Attachment } from '../types.ts';
import { 
  X, ArrowLeft, ChevronRight, Home, Menu, Download, FileText, Play, Eye, Search, BookOpen, GraduationCap, Users, CheckCircle2, Printer
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
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  
  const [isNavExpanded, setIsNavExpanded] = useState(false);
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

  const handleViewLesson = async (id: string) => {
    setLoading(true);
    try {
      const full = await db.lessons.get(id);
      setSelectedLesson(full);
      setIsNavExpanded(false);
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
      const offset = 100;
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

  /**
   * Helper to extract File ID from Google Drive links
   */
  const getDriveFileId = (url: string) => {
    if (!url) return null;
    const match = url.match(/\/d\/([^\/]+)/) || url.match(/id=([^&]+)/);
    return match ? match[1] : null;
  };

  /**
   * Converts a standard Google Drive share link to a /preview link for embedding in iframes.
   */
  const getViewableUrl = (url: string) => {
    if (!url) return '';
    const fileId = getDriveFileId(url);
    if (fileId && url.includes('drive.google.com')) {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    return url;
  };

  /**
   * Converts a Google Drive link to a direct download link.
   */
  const getDownloadUrl = (url: string) => {
    if (!url) return '';
    const fileId = getDriveFileId(url);
    if (fileId && url.includes('drive.google.com')) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return url;
  };

  const handleDownload = (e: React.MouseEvent, url: string, filename: string) => {
    // Stop propagation to prevent bubbling issues on mobile
    e.stopPropagation();
    
    const downloadUrl = getDownloadUrl(url);
    // Open in a new tab - this is the most reliable way to trigger a "download" or "open in app" behavior
    // on mobile devices without navigating away from the React app state.
    window.open(downloadUrl, '_blank');
  };

  const handlePreviewOpen = (e: React.MouseEvent, att: Attachment) => {
    e.stopPropagation();
    setViewingResource(att);
  };

  const filteredLessons = lessons.filter(l => 
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
    (categoryFilter === 'All' || l.category === categoryFilter)
  );

  const categories = ['All', ...Array.from(new Set(lessons.map(l => l.category)))];
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
    <div className="min-h-screen bg-[#F4F7FA] text-slate-900 pb-20 font-sans selection:bg-pink-100">
      
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/95 backdrop-blur-md p-0 md:p-6 overflow-hidden">
          <div className="bg-white w-full h-full md:max-w-6xl md:h-[90vh] md:rounded-[40px] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="px-4 py-4 md:px-8 md:py-6 border-b flex items-center justify-between bg-white sticky top-0 z-[210]">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="text-[#EF4E92] shrink-0" size={24} />
                <h3 className="font-black text-sm md:text-xl truncate text-[#003882]">{viewingResource.name}</h3>
              </div>
              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                
                {/* Print Button */}
                <button 
                  type="button"
                  onClick={(e) => handleDownload(e, viewingResource.storage_path, viewingResource.name)} 
                  className="bg-white text-[#003882] border border-[#003882]/20 p-3 md:px-6 md:py-3 rounded-2xl md:rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                  title="Print Resource"
                >
                  <Printer size={18} /> <span className="hidden md:inline">Print</span>
                </button>

                {/* Download Button */}
                <button 
                  type="button"
                  onClick={(e) => handleDownload(e, viewingResource.storage_path, viewingResource.name)} 
                  className="bg-[#003882] text-white p-3 md:px-6 md:py-3 rounded-2xl md:rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#002b66] active:scale-95 transition-all shadow-lg shadow-blue-100"
                >
                  <Download size={18} /> <span className="hidden md:inline">Download</span>
                </button>

                {/* Close Button */}
                <button 
                  type="button"
                  onClick={() => setViewingResource(null)} 
                  className="p-3 hover:bg-slate-100 rounded-2xl transition-colors text-slate-400 hover:text-slate-900 active:scale-90"
                >
                  <X size={24} strokeWidth={3} />
                </button>
              </div>
            </div>
            
            {/* Modal Body / Iframe */}
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

      {/* --- FLOATING NAVIGATION MAP --- */}
      {selectedLesson && lessonStructure && (
        <div className="fixed bottom-6 right-6 z-[70] flex flex-col items-end gap-3">
          <div className={`flex flex-col gap-2 mb-2 transition-all duration-300 origin-bottom-right max-h-[60vh] overflow-y-auto pr-1 scrollbar-hide ${isNavExpanded ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
            <button onClick={() => setSelectedLesson(null)} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 self-end">
              Exit Lesson
            </button>
            <div className="w-px h-4 bg-slate-200 self-end mr-6"></div>
            {lessonStructure.read.map(item => (
              <button key={item.id} onClick={() => scrollToSection(item.id)} className="bg-[#2563eb] text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg text-right hover:scale-105 transition-all">{item.title}</button>
            ))}
            {lessonStructure.teach.map(item => (
              <button key={item.id} onClick={() => scrollToSection(item.id)} className="bg-[#10b981] text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg text-right hover:scale-105 transition-all">{item.title}</button>
            ))}
            {lessonStructure.engage.map(item => (
              <button key={item.id} onClick={() => scrollToSection(item.id)} className="bg-[#EF4E92] text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg text-right hover:scale-105 transition-all">{item.title}</button>
            ))}
          </div>
          <button onClick={() => setIsNavExpanded(!isNavExpanded)} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${isNavExpanded ? 'bg-slate-900 text-white' : 'bg-[#EF4E92] text-white'}`}>
            {isNavExpanded ? <X size={24} strokeWidth={3} /> : <Menu size={24} strokeWidth={3} />}
          </button>
        </div>
      )}

      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedLesson(null)}>
            <div className="bg-[#EF4E92] w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-lg">K</div>
            <span className="font-black tracking-tighter text-[#003882] text-xl hidden sm:block uppercase">KingdomKids</span>
          </div>

          {!selectedLesson && (
            <div className="flex-1 max-w-md hidden md:block relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Search mission control..." className="w-full bg-slate-100 rounded-full pl-12 pr-6 py-2.5 text-sm focus:ring-2 focus:ring-pink-500 outline-none transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          )}

          <div className="flex items-center gap-4">
            <button onClick={onLogout} className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 tracking-widest">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-10">
        {!selectedLesson ? (
          <div className="space-y-10">
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
              {categories.map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all shadow-sm ${categoryFilter === cat ? 'bg-[#EF4E92] text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>{cat}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {loading ? Array(6).fill(0).map((_, i) => <div key={i} className="bg-white/50 h-64 rounded-[40px] animate-pulse"></div>) : filteredLessons.map(lesson => (
                <div key={lesson.id} onClick={() => handleViewLesson(lesson.id)} className="group bg-white rounded-[40px] p-8 shadow-sm hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer border-b-[8px] border-b-slate-100 hover:border-b-[#EF4E92] flex flex-col h-full">
                  <span className="text-[9px] font-black text-[#EF4E92] uppercase mb-4 block tracking-widest">{lesson.category}</span>
                  <h2 className="text-2xl font-black text-[#003882] mb-3 group-hover:text-[#EF4E92] leading-tight">{lesson.title}</h2>
                  <p className="text-slate-500 text-sm line-clamp-3 leading-relaxed mb-8 flex-1">{lesson.summary}</p>
                  <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Grades {lesson.grade_min}-{lesson.grade_max}</span>
                    <ChevronRight className="text-slate-200 group-hover:text-[#EF4E92] group-hover:translate-x-1 transition-all" size={20} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* --- SELECTED LESSON VIEW --- */
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="mb-20">
              <span className="bg-[#EF4E92] text-white px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md inline-block">{selectedLesson.category}</span>
              <h1 className="text-4xl md:text-7xl font-black text-[#003882] tracking-tighter mt-8 leading-[1.05] mb-6">{selectedLesson.title}</h1>
              <p className="text-xl md:text-2xl text-slate-400 font-medium italic leading-relaxed">"{selectedLesson.summary}"</p>
            </div>

            <div className="space-y-32">
              {[
                { id: 'read-anchor', key: 'read', color: '#2563eb', label: '1. READ', icon: <BookOpen size={24} /> },
                { id: 'teach-anchor', key: 'teach', color: '#10b981', label: '2. TEACH', icon: <GraduationCap size={24} /> },
                { id: 'engage-anchor', key: 'engage', color: '#EF4E92', label: '3. ENGAGE', icon: <Users size={24} /> }
              ].map((pillar) => (
                <section key={pillar.key} id={pillar.id} className="scroll-mt-24">
                  <div className="flex items-center gap-4 mb-12">
                    <div className="p-3 rounded-2xl text-white shadow-lg" style={{ backgroundColor: pillar.color }}>{pillar.icon}</div>
                    <h3 className="text-3xl md:text-4xl font-black tracking-tighter uppercase text-[#003882]">{pillar.label}</h3>
                  </div>
                  <div className="flex flex-col gap-10">
                    {lessonStructure && lessonStructure[pillar.key].map((section) => (
                      <div 
                        key={section.id} 
                        id={section.id}
                        className={`bg-white rounded-[40px] p-8 md:p-12 shadow-sm border-t-[12px] scroll-mt-28 transition-all duration-500 ${
                          activeReadingId === section.id 
                          ? 'scale-[1.02] ring-8 ring-pink-50 shadow-2xl border-t-[#EF4E92]' 
                          : 'hover:shadow-xl'
                        }`} 
                        style={{ borderTopColor: activeReadingId === section.id ? '#EF4E92' : pillar.color }}
                      >
                        <div className="flex items-center justify-between mb-8">
                          <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{section.title}</h4>
                          <CheckCircle2 className={`transition-all ${activeReadingId === section.id ? 'text-[#EF4E92] scale-125' : 'text-slate-50'}`} size={20} />
                        </div>
                        <p className="text-slate-700 text-lg md:text-2xl leading-relaxed font-medium whitespace-pre-wrap">{section.content}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Media HUB */}
            <section id="media-hub" className="mt-40 scroll-mt-24">
              <div className="flex items-center gap-3 mb-12">
                <div className="h-10 w-2 bg-slate-800 rounded-full"></div>
                <h3 className="text-3xl font-black text-[#003882] uppercase tracking-tighter">Media Hub</h3>
              </div>
              <div className="flex flex-col gap-10">
                {selectedLesson.videos?.map((vid, i) => (
                  <div key={i} className="bg-slate-900 rounded-[48px] overflow-hidden aspect-video shadow-2xl relative border-4 border-white">
                    {activeVideo?.url === vid.url ? (
                      <iframe src={`https://www.youtube.com/embed/${vid.url.includes('v=') ? vid.url.split('v=')[1].split('&')[0] : vid.url.split('/').pop()}`} className="w-full h-full" allowFullScreen allow="autoplay" title={vid.title || 'Lesson Video'} />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-800 relative group">
                        <button onClick={() => setActiveVideo(vid)} className="w-24 h-24 bg-white text-slate-900 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl relative z-10">
                          <Play fill="currentColor" size={32} />
                        </button>
                        <span className="text-white/60 font-black mt-8 uppercase text-[11px] tracking-widest relative z-10">{vid.title || 'Play Lesson Media'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Resources HUB */}
            <section id="resource-hub" className="mt-40 scroll-mt-24 pb-80 md:pb-40">
              <div className="flex items-center gap-3 mb-12">
                <div className="h-10 w-2 bg-[#003882] rounded-full"></div>
                <h3 className="text-3xl font-black text-[#003882] uppercase tracking-tighter">Resources</h3>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {selectedLesson.attachments?.map((att, i) => (
                  <div key={i} className="bg-white rounded-[40px] p-5 md:p-8 flex items-center justify-between border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-visible z-10">
                    <div className="flex items-center gap-4 md:gap-6 min-w-0 flex-1">
                      {/* Removed the doc icon div here as requested */}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-slate-800 text-xs md:text-base truncate pr-2" title={att.name}>{att.name}</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ready to access</p>
                      </div>
                    </div>
                    <div className="flex gap-3 shrink-0 ml-4 relative z-20">
                      <button 
                        type="button"
                        onClick={(e) => handlePreviewOpen(e, att)}
                        className="p-4 bg-slate-50 text-[#EF4E92] rounded-2xl hover:bg-pink-50 transition-all active:scale-90 border border-pink-100 shadow-sm cursor-pointer"
                        title="View in App"
                      >
                        <Eye size={22} />
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => handleDownload(e, att.storage_path, att.name)} 
                        className="p-4 bg-blue-50 text-[#003882] rounded-2xl hover:bg-blue-100 transition-all active:scale-90 border border-blue-100 shadow-sm cursor-pointer"
                        title="Download File"
                      >
                        <Download size={22} />
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