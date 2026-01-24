
import React, { useState, useEffect } from 'react';
import { db } from '../services/supabaseService.ts';
import { categorizeLessonTitle, generateFullLesson } from '../services/geminiService.ts';
import { Lesson, LessonStatus, UserRole, Profile, LessonActivity, LessonVideo, Attachment, LessonContentStructure, LessonSubSection } from '../types.ts';
import { 
  Plus, Search, LayoutGrid, ChevronRight, Book, History, Music, ScrollText, Cross, Send, Map, ArrowLeft, Trash2, Edit3, Globe, Sparkles, X
} from 'lucide-react';

// Helper components defined outside of the main component

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex items-center gap-3 mb-4 md:mb-6">
    <div className="h-5 md:h-6 w-1 md:w-1.5 bg-[#EF4E92] rounded-full"></div>
    <h3 className="font-black text-lg md:text-xl tracking-tight uppercase text-[#003882]">{title}</h3>
  </div>
);

interface SubSectionCardProps {
  sub: LessonSubSection;
  onUpdate: (updates: Partial<LessonSubSection>) => void;
  onDelete: () => void;
  placeholder: string;
}

const SubSectionCard: React.FC<SubSectionCardProps> = ({ 
  sub, 
  onUpdate, 
  onDelete, 
  placeholder 
}) => {
  const [bibleReference, setBibleReference] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  const isBibleCard = sub.title.toLowerCase().includes('bible text');

  const fetchBibleText = async () => {
    const sanitizedQuery = bibleReference.trim().replace(/–|—/g, '-');
    if (!sanitizedQuery) return alert("Please enter a reference (e.g. Genesis 1-2)");

    setIsFetching(true);
    try {
      const res = await fetch(`https://bible-api.com/${encodeURIComponent(sanitizedQuery)}`);
      if (!res.ok) throw new Error("Reference not found.");
      const data = await res.json();
      if (data && data.text) {
        onUpdate({ content: data.text.trim() });
      }
    } catch (e: any) {
      alert("Failed to fetch Bible text.");
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="bg-white p-5 md:p-6 rounded-[30px] relative shadow-sm border-2 border-transparent hover:border-pink-50 transition-all group flex flex-col min-h-[160px]">
      {!isBibleCard && (
        <button onClick={onDelete} className="absolute top-4 right-6 text-gray-300 hover:text-red-500 transition-colors z-10">
          <Trash2 size={16} />
        </button>
      )}
      <div className="mb-2">
        <input 
          type="text"
          className="w-full bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-gray-400 focus:text-[#003882] outline-none"
          value={sub.title}
          onChange={e => onUpdate({ title: e.target.value })}
          placeholder="Section Label"
          readOnly={isBibleCard}
        />
      </div>
      {isBibleCard && (
        <div className="mb-4 flex gap-2">
          <input 
            type="text"
            className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 text-xs focus:border-[#EF4E92] outline-none transition-all font-medium"
            placeholder="Reference (e.g. John 3:16)"
            value={bibleReference}
            onChange={e => setBibleReference(e.target.value)}
          />
          <button onClick={fetchBibleText} disabled={isFetching} className="bg-[#003882] text-white px-4 rounded-xl text-[9px] font-black uppercase tracking-widest">
            {isFetching ? "..." : "Fetch"}
          </button>
        </div>
      )}
      <textarea 
        rows={4} 
        placeholder={placeholder} 
        className="w-full bg-transparent border-none text-sm leading-relaxed outline-none resize-none text-gray-600 font-medium flex-1 scrollbar-hide" 
        value={sub.content} 
        onChange={e => onUpdate({ content: e.target.value })} 
      />
    </div>
  );
};

const DEFAULT_LESSON_TEMPLATE: LessonContentStructure = {
  read: [
    { id: 'tpl-r1', title: 'Bible Text', content: '' },
    { id: 'tpl-r2', title: 'Memory Verse', content: '' }
  ],
  teach: [
    { id: 'tpl-t1', title: 'Big Picture', content: '' },
    { id: 'tpl-t2', title: 'Teach the Story', content: '' },
    { id: 'tpl-t3', title: 'Gospel Connection', content: '' }
  ],
  engage: [
    { id: 'tpl-e1', title: 'Discussion', content: '' },
    { id: 'tpl-e2', title: 'Crafts', content: '' }
  ]
};

interface AdminDashboardProps {
  user: Profile;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('ALL MISSIONS');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState<Partial<Lesson>>({
    title: '', summary: '', content: '', category: 'HISTORY', series: '', grade_min: 1, grade_max: 5, tags: [], status: LessonStatus.DRAFT
  });
  
  const [structure, setStructure] = useState<LessonContentStructure>({
    read: [], teach: [], engage: []
  });

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

  const [activities, setActivities] = useState<Partial<LessonActivity>[]>([]);
  const [videos, setVideos] = useState<Partial<LessonVideo>[]>([]);
  const [attachments, setAttachments] = useState<Partial<Attachment>[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiGoal, setAiGoal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    try {
      const data = await db.lessons.list(UserRole.ADMIN);
      setLessons(data);
    } catch (e) {
      console.error(e);
    }
  };

  const parseMarkdownToStructure = (md: string) => {
    const newStructure: LessonContentStructure = { read: [], teach: [], engage: [] };
    if (!md) return newStructure;
    const mainSections = md.split(/^# \d\. /m);
    ['read', 'teach', 'engage'].forEach((key, i) => {
      const fullBlock = mainSections[i + 1] || '';
      const parts = fullBlock.split(/^## /m);
      (newStructure as any)[key] = parts.slice(1).filter(s => s.trim()).map(s => {
        const lines = s.split('\n');
        return { id: Math.random().toString(36).substr(2, 9), title: lines[0].trim(), content: lines.slice(1).join('\n').trim() };
      });
    });
    return newStructure;
  };

  const serializeStructureToMarkdown = () => {
    const serializeBox = (title: string, items: LessonSubSection[]) => 
      `# ${title}\n\n` + items.map(i => `## ${i.title}\n${i.content}`).join('\n\n');
    return [
      serializeBox('1. Read', structure.read),
      serializeBox('2. Teach', structure.teach),
      serializeBox('3. Engage', structure.engage)
    ].join('\n\n');
  };

  const handleEdit = async (id: string) => {
    try {
      const full = await db.lessons.get(id);
      if (full) {
        setEditingId(id);
        setFormData(full);
        setStructure(parseMarkdownToStructure(full.content || ''));
        setActivities(full.activities || []);
        setVideos(full.videos || []);
        setAttachments(full.attachments || []);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) {
      alert("Error loading lesson.");
    }
  };

  const handleNew = () => {
    setEditingId('new');
    setFormData({ title: '', summary: '', category: activeCategory === 'ALL MISSIONS' ? 'HISTORY' : activeCategory, status: LessonStatus.DRAFT });
    setStructure({
      read: DEFAULT_LESSON_TEMPLATE.read.map(i => ({ ...i, id: Math.random().toString(36).substr(2, 9) })),
      teach: DEFAULT_LESSON_TEMPLATE.teach.map(i => ({ ...i, id: Math.random().toString(36).substr(2, 9) })),
      engage: DEFAULT_LESSON_TEMPLATE.engage.map(i => ({ ...i, id: Math.random().toString(36).substr(2, 9) }))
    });
    setActivities([]); setVideos([]); setAttachments([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (status: LessonStatus) => {
    if (!formData.title) return alert("Title required.");
    setLoading(true);
    try {
      const payload = { ...formData, content: serializeStructureToMarkdown(), status, created_by: user.id };
      if (editingId === 'new') delete (payload as any).id;
      await db.lessons.upsert(payload, activities, videos, attachments);
      alert("Lesson Saved!");
      setEditingId(null);
      fetchLessons();
    } catch (e) {
      alert("Save failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiGoal.trim()) return;
    setIsGenerating(true);
    try {
      const result = await generateFullLesson(aiGoal, lessons.map(l => l.title).join(', '));
      if (result) {
        setFormData(prev => ({ ...prev, title: result.title, summary: result.summary }));
        setStructure({
          read: result.read.map((r: any) => ({ id: Math.random().toString(36).substr(2, 9), title: r.title, content: r.content })),
          teach: result.teach.map((t: any) => ({ id: Math.random().toString(36).substr(2, 9), title: t.title, content: t.content })),
          engage: result.engage.map((e: any) => ({ id: Math.random().toString(36).substr(2, 9), title: e.title, content: e.content })),
        });
        setIsAiModalOpen(false);
      }
    } catch (e) {
      alert("AI Error.");
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredLessons = lessons.filter(l => 
    (activeCategory === 'ALL MISSIONS' || l.category === activeCategory) &&
    (l.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#F4F7FA] flex flex-col md:flex-row font-sans">
      
      {/* SIDEBAR NAVIGATION */}
      {!editingId && (
        <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen overflow-y-auto z-50">
          <div className="p-8 border-b border-slate-100 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-[#EF4E92] w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-lg">K</div>
              <span className="font-black text-xl tracking-tighter text-[#003882] uppercase">Admin Hub</span>
            </div>
            <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase">Kingdom Kids FP</p>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${
                  activeCategory === cat.name 
                  ? 'bg-[#003882] text-white shadow-xl shadow-blue-100' 
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                <span className={activeCategory === cat.name ? 'text-[#EF4E92]' : 'text-slate-300'}>{cat.icon}</span>
                {cat.name}
              </button>
            ))}
          </nav>

          <div className="p-8 border-t border-slate-100 mt-6">
            <button onClick={onLogout} className="text-[10px] font-black uppercase text-red-400 hover:text-red-600 tracking-widest flex items-center gap-2">
              <ArrowLeft size={14} /> LOGOUT
            </button>
          </div>
        </aside>
      )}

      {/* MAIN CONTENT STAGE */}
      <main className="flex-1 min-w-0">
        {!editingId ? (
          <div className="p-6 md:p-12 animate-in fade-in duration-700">
            {/* Stage Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
              <div>
                <h1 className="text-4xl md:text-5xl font-black text-[#003882] tracking-tighter uppercase mb-2">
                  {activeCategory}
                </h1>
                <p className="text-slate-400 font-medium">Manage and architect your Sunday missions.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search titles..." 
                    className="pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#EF4E92] transition-all shadow-sm w-full md:w-64"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleNew}
                  className="bg-[#EF4E92] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-pink-100 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shrink-0"
                >
                  <Plus size={20} /> New Mission
                </button>
              </div>
            </div>

            {/* Missions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredLessons.map((l) => (
                <div 
                  key={l.id} 
                  onClick={() => handleEdit(l.id)}
                  className="group bg-white rounded-[48px] p-8 border border-slate-50 shadow-sm hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer flex flex-col min-h-[340px]"
                >
                  <div className="flex justify-between items-start mb-8">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${l.status === LessonStatus.PUBLISHED ? 'bg-emerald-50 text-emerald-500' : 'bg-orange-50 text-orange-500'}`}>
                      {l.status}
                    </span>
                    <button className="text-slate-200 group-hover:text-[#EF4E92] transition-colors">
                      <Edit3 size={20} />
                    </button>
                  </div>
                  <h3 className="text-2xl font-black text-[#003882] tracking-tight mb-4 group-hover:text-[#EF4E92] leading-tight">
                    {l.title}
                  </h3>
                  <p className="text-slate-400 text-sm line-clamp-3 font-medium mb-auto leading-relaxed italic">
                    {l.summary || "No summary provided for this mission."}
                  </p>
                  <div className="pt-8 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Map size={14} className="text-slate-300" />
                      <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest">{l.category}</span>
                    </div>
                    <ChevronRight size={18} className="text-slate-200 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
              {filteredLessons.length === 0 && (
                <div className="col-span-full h-80 flex flex-col items-center justify-center bg-white/50 rounded-[48px] border-2 border-dashed border-slate-200">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-6">
                    <ScrollText size={32} />
                  </div>
                  <p className="font-black uppercase tracking-widest text-slate-400 text-[10px]">No missions found in this category.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* MISSION ARCHITECT (EDITOR) */
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 bg-white min-h-screen">
            {/* Editor Toolbar */}
            <header className="sticky top-0 z-[60] bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 md:px-12 py-5 flex items-center justify-between gap-6 shadow-sm">
              <div className="flex items-center gap-4 min-w-0">
                <button onClick={() => setEditingId(null)} className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors shrink-0">
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-xl md:text-2xl font-black text-[#003882] tracking-tighter truncate uppercase">
                  {formData.title || "Untitled Mission"}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsAiModalOpen(true)} className="hidden md:flex bg-[#EF4E92] text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest gap-2 items-center hover:scale-105 transition-all shadow-lg shadow-pink-100">
                  <Sparkles size={16} /> AI Architect
                </button>
                <button onClick={() => handleSave(LessonStatus.DRAFT)} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">
                  Save Draft
                </button>
                <button onClick={() => handleSave(LessonStatus.PUBLISHED)} className="bg-[#EF4E92] text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-pink-100 hover:scale-105 transition-all">
                  Publish
                </button>
              </div>
            </header>

            <div className="max-w-6xl mx-auto p-6 md:p-12 space-y-16">
              {/* Identity Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <SectionHeader title="Mission Identity" />
                  <input 
                    placeholder="Compelling Title..." 
                    className="w-full bg-slate-50 border-none rounded-[32px] px-8 py-6 text-2xl font-black text-[#003882] outline-none focus:ring-4 focus:ring-pink-50 transition-all"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                  />
                  <textarea 
                    placeholder="Short summary for the mission report..." 
                    className="w-full bg-slate-50 border-none rounded-[32px] px-8 py-6 text-sm font-medium outline-none focus:ring-4 focus:ring-pink-50 transition-all resize-none h-32"
                    value={formData.summary}
                    onChange={e => setFormData({...formData, summary: e.target.value})}
                  />
                </div>
                <div className="space-y-4">
                  <SectionHeader title="Parameters" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 px-4">Category</label>
                      <select 
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest outline-none"
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                      >
                        {categories.filter(c => c.name !== 'ALL MISSIONS').map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 px-4">Series</label>
                      <input 
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs font-black outline-none" 
                        placeholder="Mission Series..." 
                        value={formData.series}
                        onChange={e => setFormData({...formData, series: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Lesson Body Architect */}
              <div className="space-y-8">
                <SectionHeader title="The Blueprint" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {(['read', 'teach', 'engage'] as const).map((col) => (
                    <div key={col} className="bg-slate-50/50 rounded-[48px] p-6 flex flex-col gap-6">
                      <div className="flex items-center justify-between px-4">
                        <h4 className="font-black text-[10px] text-[#003882] uppercase tracking-[0.3em]">{col}</h4>
                        <button 
                          onClick={() => setStructure(prev => ({...prev, [col]: [...prev[col], { id: Math.random().toString(36).substr(2, 9), title: 'New Instruction', content: '' }]}))}
                          className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#EF4E92] shadow-sm hover:scale-110 transition-all"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <div className="space-y-4">
                        {structure[col].map(sub => (
                          <SubSectionCard 
                            key={sub.id} 
                            sub={sub} 
                            onUpdate={updates => setStructure(prev => ({...prev, [col]: prev[col].map(s => s.id === sub.id ? {...s, ...updates} : s)}))}
                            onDelete={() => setStructure(prev => ({...prev, [col]: prev[col].filter(s => s.id !== sub.id)}))}
                            placeholder={`Architect instructions for ${sub.title}...`} 
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* AI ARCHITECT MODAL */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#003882]/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[64px] p-10 md:p-16 shadow-2xl relative overflow-hidden">
            <button onClick={() => setIsAiModalOpen(false)} className="absolute top-10 right-12 text-slate-300 hover:text-slate-900 transition-colors">
              <X size={32} />
            </button>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-16 h-16 bg-pink-50 rounded-3xl flex items-center justify-center text-[#EF4E92] animate-pulse">
                <Sparkles size={32} />
              </div>
              <div>
                <h2 className="text-4xl font-black text-[#003882] tracking-tighter uppercase">AI Architect</h2>
                <p className="text-slate-400 font-medium">Describe your vision. The AI builds the mission.</p>
              </div>
            </div>
            <textarea 
              rows={6} 
              className="w-full bg-slate-50 border-none rounded-[32px] px-8 py-8 outline-none text-lg font-medium text-slate-800 focus:ring-4 focus:ring-pink-50 transition-all resize-none mb-10"
              placeholder="Ex: Teach the Parable of the Sower focusing on how we listen to God's word..."
              value={aiGoal}
              onChange={e => setAiGoal(e.target.value)}
            />
            <button 
              onClick={handleAiGenerate}
              disabled={isGenerating || !aiGoal.trim()}
              className="w-full bg-[#EF4E92] text-white rounded-[32px] py-6 font-black uppercase tracking-widest shadow-2xl shadow-pink-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-4"
            >
              {isGenerating ? (
                <>
                  <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  Building Lesson...
                </>
              ) : (
                <>Architect Blueprint</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
