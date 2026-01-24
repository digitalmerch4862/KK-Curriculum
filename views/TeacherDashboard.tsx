import React, { useState, useEffect } from 'react';
import { db } from '../services/supabaseService.ts';
import { Lesson, UserRole, Profile, LessonContentStructure, LessonVideo, Attachment } from '../types.ts';
import { 
  Play, FileText, Printer, X, ArrowLeft, Eye, 
  BookOpen, GraduationCap, Users, ChevronRight, CheckCircle2, 
  Search, Home, Video, FolderOpen, Menu, Hash
} from 'lucide-react';

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

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const data = await db.lessons.list(UserRole.TEACHER);
      setLessons(data);
    } catch (e) { console.error("Error fetching data", e); }
    finally { setLoading(false); }
  };

  const handleViewLesson = async (id: string) => {
    setLoading(true);
    try {
      const full = await db.lessons.get(id);
      setSelectedLesson(full);
      setIsNavExpanded(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { alert("Error loading lesson details."); }
    finally { setLoading(false); }
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

  const handlePrint = (url: string) => {
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.focus();
      printWindow.print();
    }
  };

  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com/watch?v=')) return url.replace('watch?v=', 'embed/');
    if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'youtube.com/embed/');
    return url;
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
        return {
          id: `${key}-sub-${idx}`,
          title: lines[0].trim(),
          content: lines.slice(1).join('\n').trim()
        };
      });
    });
    return newStructure;
  };

  const filteredLessons = lessons.filter(l => 
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
    (categoryFilter === 'All' || l.category === categoryFilter)
  );

  const lessonStructure = selectedLesson ? parseMarkdownToStructure(selectedLesson.content || '') : null;

  return (
    <div className="min-h-screen bg-[#F3F7FA] text-slate-900 pb-20 font-sans selection:bg-indigo-100">
      
      {/* --- EXPANDABLE FLOATING NAV --- */}
      {selectedLesson && lessonStructure && (
        <div className="fixed bottom-6 right-6 md:right-10 md:bottom-10 z-[70] flex flex-col items-end gap-3">
          
          <div className={`flex flex-col gap-2 mb-2 transition-all duration-300 origin-bottom max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide ${isNavExpanded ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
            
            <button onClick={() => setSelectedLesson(null)} className="flex items-center gap-3 group self-end mb-2">
              <span className="bg-slate-800 text-white text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest shadow-xl">Exit Lesson</span>
              <div className="w-11 h-11 rounded-xl bg-white shadow-lg flex items-center justify-center text-slate-800 border border-slate-100"><Home size={20} /></div>
            </button>

            {/* READ (BLUE) */}
            <p className="text-[8px] font-black text-blue-600 uppercase tracking-[0.2em] mr-2">Read</p>
            {lessonStructure.read.map((item) => (
              <button key={item.id} onClick={() => scrollToSection(item.id)} className="flex items-center gap-3 group">
                <span className="bg-white text-slate-600 text-[9px] font-black px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity uppercase border border-slate-100 shadow-sm">{item.title}</span>
                <div className="w-11 h-11 rounded-xl bg-blue-600 text-white shadow-md flex items-center justify-center hover:scale-110 transition-transform"><BookOpen size={18} /></div>
              </button>
            ))}

            {/* TEACH (GREEN) */}
            <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.2em] mr-2 mt-3">Teach</p>
            {lessonStructure.teach.map((item) => (
              <button key={item.id} onClick={() => scrollToSection(item.id)} className="flex items-center gap-3 group">
                <span className="bg-white text-slate-600 text-[9px] font-black px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity uppercase border border-slate-100 shadow-sm">{item.title}</span>
                <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white shadow-md flex items-center justify-center hover:scale-110 transition-transform"><GraduationCap size={18} /></div>
              </button>
            ))}

            {/* ENGAGE (PINK) */}
            <p className="text-[8px] font-black text-[#EF4E92] uppercase tracking-[0.2em] mr-2 mt-3">Engage</p>
            {lessonStructure.engage.map((item) => (
              <button key={item.id} onClick={() => scrollToSection(item.id)} className="flex items-center gap-3 group">
                <span className="bg-white text-slate-600 text-[9px] font-black px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity uppercase border border-slate-100 shadow-sm">{item.title}</span>
                <div className="w-11 h-11 rounded-xl bg-[#EF4E92] text-white shadow-md flex items-center justify-center hover:scale-110 transition-transform"><Users size={18} /></div>
              </button>
            ))}

            <div className="h-[1px] bg-slate-200 w-full my-2" />
            <button onClick={() => scrollToSection('media-section')} className="flex items-center gap-3 group">
              <span className="bg-white text-slate-600 text-[9px] font-black px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity uppercase border border-slate-100 shadow-sm">Media Center</span>
              <div className="w-11 h-11 rounded-xl bg-slate-800 text-white shadow-md flex items-center justify-center hover:scale-110 transition-transform"><Video size={18} /></div>
            </button>
            <button onClick={() => scrollToSection('assets-section')} className="flex items-center gap-3 group">
              <span className="bg-white text-slate-600 text-[9px] font-black px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity uppercase border border-slate-100 shadow-sm">Resources</span>
              <div className="w-11 h-11 rounded-xl bg-slate-800 text-white shadow-md flex items-center justify-center hover:scale-110 transition-transform"><FolderOpen size={18} /></div>
            </button>
          </div>

          <button 
            onClick={() => setIsNavExpanded(!isNavExpanded)}
            className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${isNavExpanded ? 'bg-slate-900 rotate-90' : 'bg-[#EF4E92] shadow-pink-200'}`}
          >
            {isNavExpanded ? <X className="text-white" size={28} /> : <Menu className="text-white" size={28} />}
          </button>
        </div>
      )}

      {/* --- HEADER --- */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedLesson(null)}>
            <div className="bg-[#EF4E92] w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-lg text-base">K</div>
            <span className="font-black tracking-tighter text-[#003882] text-xl hidden sm:block">KINGDOMKIDS</span>
          </div>
          <button onClick={onLogout} className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 tracking-widest">Logout</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 mt-10">
        {!selectedLesson ? (
          /* --- LIST VIEW --- */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredLessons.map(lesson => (
              <div 
                key={lesson.id} 
                onClick={() => handleViewLesson(lesson.id)} 
                className="bg-white rounded-[40px] p-8 shadow-sm hover:shadow-xl transition-all cursor-pointer border-b-[8px] border-b-slate-100 hover:border-b-[#EF4E92] group"
              >
                <span className="text-[9px] font-black text-[#EF4E92] uppercase mb-2 block tracking-widest">{lesson.category}</span>
                <h2 className="text-2xl font-black text-[#003882] mb-3 group-hover:text-[#EF4E92] leading-tight">{lesson.title}</h2>
                <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed">{lesson.summary}</p>
              </div>
            ))}
          </div>
        ) : (
          /* --- LESSON CONTENT --- */
          <div className="animate-in fade-in duration-700">
            <div className="mb-16">
              <span className="bg-[#EF4E92] text-white px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{selectedLesson.category}</span>
              <h1 className="text-4xl md:text-7xl font-black text-[#003882] tracking-tighter mt-6 leading-[1.1] mb-6">{selectedLesson.title}</h1>
              <p className="text-xl md:text-2xl text-slate-400 font-medium italic leading-relaxed">"{selectedLesson.summary}"</p>
            </div>

            {/* NESTED PILLARS (SINGLE COLUMN) */}
            <div className="space-y-24">
              {[
                { id: 'read-section', key: 'read', icon: <BookOpen />, color: '#2563eb', label: '1. READ' },
                { id: 'teach-section', key: 'teach', icon: <GraduationCap />, color: '#10b981', label: '2. TEACH' },
                { id: 'engage-section', key: 'engage', icon: <Users />, color: '#EF4E92', label: '3. ENGAGE' }
              ].map((pillar) => (
                <section key={pillar.key} id={pillar.id} className="scroll-mt-24">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="p-3.5 rounded-2xl text-white shadow-lg" style={{ backgroundColor: pillar.color }}>{pillar.icon}</div>
                    <h3 className="text-3xl md:text-4xl font-black tracking-tighter uppercase text-[#003882]">{pillar.label}</h3>
                  </div>

                  <div className="flex flex-col gap-8">
                    {lessonStructure && lessonStructure[pillar.key].map((section) => (
                      <div 
                        key={section.id} 
                        id={section.id}
                        className="bg-white rounded-[40px] p-8 md:p-12 shadow-sm border-t-[12px] hover:shadow-md transition-all scroll-mt-28" 
                        style={{ borderTopColor: pillar.color }}
                      >
                        <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-6">{section.title}</h4>
                        <p className="text-slate-700 text-lg md:text-2xl leading-relaxed font-medium whitespace-pre-wrap">
                          {section.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* VIDEOS & MEDIA (RESTORED) */}
            <section id="media-section" className="mt-32 scroll-mt-24">
              <div className="flex items-center gap-3 mb-10">
                <div className="h-8 w-2 bg-slate-800 rounded-full"></div>
                <h3 className="text-3xl font-black text-[#003882] uppercase tracking-tighter">Media Hub</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {selectedLesson.videos?.map((vid, i) => (
                  <div key={i} className="bg-slate-900 rounded-[48px] overflow-hidden aspect-video shadow-2xl relative border-4 border-white">
                    {activeVideo?.url === vid.url ? (
                      <iframe src={getEmbedUrl(vid.url)} className="w-full h-full" allowFullScreen allow="autoplay" title={vid.title} />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-800">
                        <button onClick={() => setActiveVideo(vid)} className="w-20 h-20 bg-white text-slate-900 rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                          <Play fill="currentColor" size={32} />
                        </button>
                        <span className="text-white/40 font-black mt-6 uppercase text-[10px] tracking-widest">{vid.title}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* RESOURCES & DOWNLOADS (RESTORED) */}
            <section id="assets-section" className="mt-32 scroll-mt-24">
              <div className="flex items-center gap-3 mb-10">
                <div className="h-8 w-2 bg-[#003882] rounded-full"></div>
                <h3 className="text-3xl font-black text-[#003882] uppercase tracking-tighter">Lesson Assets</h3>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {selectedLesson.attachments?.map((att, i) => (
                  <div key={i} className="bg-white rounded-[32px] p-6 flex flex-col border border-slate-100 shadow-sm hover:border-[#003882]/20 transition-all">
                    <div className="bg-slate-50 w-full aspect-square rounded-[24px] flex items-center justify-center text-slate-300 mb-6"><FileText size={40} /></div>
                    <h4 className="font-black text-slate-800 text-xs md:text-sm mb-8 truncate">{att.name}</h4>
                    <div className="flex gap-2 mt-auto">
                      <button onClick={() => setViewingResource(att)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-black text-[9px] uppercase hover:bg-slate-200 transition-colors">View</button>
                      <button onClick={() => handlePrint(att.storage_path)} className="p-3 bg-blue-50 text-[#003882] rounded-xl hover:bg-blue-100"><Printer size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* RESOURCE PREVIEW MODAL */}
      {viewingResource && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[40px] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="font-black text-xl">{viewingResource.name}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => handlePrint(viewingResource.storage_path)} className="bg-[#003882] text-white px-6 py-3 rounded-full font-black text-xs uppercase flex items-center gap-2"><Printer size={16} /> Print</button>
                <button onClick={() => setViewingResource(null)} className="p-3 hover:bg-slate-100 rounded-full"><X /></button>
              </div>
            </div>
            <iframe src={viewingResource.storage_path} className="flex-1 w-full border-none" title="Asset View" />
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;