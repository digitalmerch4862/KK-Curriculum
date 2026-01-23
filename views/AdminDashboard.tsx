
import React, { useState, useEffect } from 'react';
import { db } from '../services/supabaseService.ts';
import { categorizeLessonTitle, generateFullLesson } from '../services/geminiService.ts';
import { Lesson, LessonStatus, UserRole, Profile, LessonActivity, LessonVideo, Attachment, LessonContentStructure, LessonSubSection } from '../types.ts';

// Helper components defined outside of the main component

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex items-center gap-3 mb-6 md:mb-8">
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
}) => (
  <div className="bg-[#F9FAFB] p-6 md:p-8 rounded-[40px] space-y-4 relative group border border-transparent hover:border-pink-100 transition-all shadow-sm">
    <button 
      onClick={onDelete} 
      className="absolute top-6 right-8 text-gray-300 hover:text-red-500 transition-opacity opacity-0 group-hover:opacity-100"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
    <div className="pr-10">
      <input 
        className="bg-transparent border-none font-black text-sm w-full outline-none text-gray-800 uppercase tracking-wide" 
        value={sub.title} 
        onChange={e => onUpdate({ title: e.target.value })} 
      />
    </div>
    <div className="bg-white rounded-[24px] p-2 border border-gray-100">
      <textarea 
        rows={10} 
        placeholder={placeholder} 
        className="w-full bg-transparent border-none p-4 text-sm leading-relaxed outline-none resize-none text-gray-600 font-medium" 
        value={sub.content} 
        onChange={e => onUpdate({ content: e.target.value })} 
      />
    </div>
  </div>
);

interface AdminDashboardProps {
  user: Profile;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Lesson>>({
    title: '', summary: '', content: '', category: 'History', series: '', grade_min: 1, grade_max: 5, tags: [], status: LessonStatus.DRAFT
  });
  
  const [structure, setStructure] = useState<LessonContentStructure>({
    read: [],
    teach: [],
    engage: []
  });

  const categories = [
    'Pentateuch',
    'History',
    'Poetry',
    'The Prophets',
    'The Gospels',
    'Acts & Epistles',
    'Revelation'
  ];

  const [activities, setActivities] = useState<Partial<LessonActivity>[]>([]);
  const [videos, setVideos] = useState<Partial<LessonVideo>[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [downloadLinks, setDownloadLinks] = useState<{name: string, url: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Modal States
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiStep, setAiStep] = useState<'questions' | 'preview'>('questions');
  const [aiGoal, setAiGoal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationHistory, setGenerationHistory] = useState<{title: string, structure: LessonContentStructure}[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);

  useEffect(() => {
    fetchLessons();
  }, []);

  useEffect(() => {
    if (editingId && formData.content && editingId !== 'new') {
      parseMarkdownToStructure(formData.content);
    }
  }, [editingId]);

  const parseMarkdownToStructure = (md: string) => {
    const newStructure: LessonContentStructure = { read: [], teach: [], engage: [] };
    const mainSections = md.split(/^# \d\. /m);
    
    ['read', 'teach', 'engage'].forEach((key, i) => {
      const sectionContent = mainSections[i + 1] || '';
      const subSections = sectionContent.split(/^## /m).filter(s => s.trim());
      (newStructure as any)[key] = subSections.map(s => {
        const lines = s.split('\n');
        const content = lines.slice(1).join('\n').trim();
        return {
          id: Math.random().toString(36).substr(2, 9),
          title: lines[0].trim(),
          content: content
        };
      });
    });
    setStructure(newStructure);
  };

  const serializeStructureToMarkdown = () => {
    const serializeBox = (title: string, items: LessonSubSection[]) => {
      return `# ${title}\n\n` + items.map(i => `## ${i.title}\n${i.content}`).join('\n\n');
    };
    return [
      serializeBox('1. Read', structure.read),
      serializeBox('2. Teach', structure.teach),
      serializeBox('3. Engage', structure.engage)
    ].join('\n\n');
  };

  const fetchLessons = async () => {
    try {
      const data = await db.lessons.list(UserRole.ADMIN);
      setLessons(data);
      setError(null);
    } catch (e: any) {
      console.error("Fetch lessons error:", e);
      setError(`Failed to load lessons. Error: ${e.message}`);
    }
  };

  const handleEdit = async (id: string) => {
    setError(null);
    try {
      const full = await db.lessons.get(id);
      if (full) {
        setEditingId(id);
        setFormData(full);
        setActivities(full.activities || []);
        setVideos(full.videos || []);
        setAttachments(full.attachments || []);
        setDownloadLinks((full.attachments || []).map((at: Attachment) => ({ name: at.name, url: at.storage_path }))); 
        setGenerationHistory([]);
        setCurrentHistoryIndex(-1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e: any) {
      setError(`Error loading lesson: ${e.message}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // CRITICAL: Stop propagation to prevent opening the editor
    if (!window.confirm("Are you sure you want to permanently delete this lesson? This action cannot be undone.")) return;
    
    setLoading(true);
    try {
      await db.lessons.delete(id);
      // If we deleted the lesson currently being edited, close the editor
      if (editingId === id) {
        setEditingId(null);
      }
      await fetchLessons();
      alert("Lesson deleted successfully.");
    } catch (e: any) {
      alert("Delete failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setEditingId('new');
    setFormData({ 
      title: '', summary: '', content: '', category: 'History', series: '', grade_min: 1, grade_max: 5, tags: [], status: LessonStatus.DRAFT 
    });
    setStructure({
      read: [
        { id: '1', title: 'Bible Text', content: '' },
        { id: '2', title: 'Memory Verse', content: '' }
      ],
      teach: [
        { id: '3', title: 'The Big Picture', content: '' },
        { id: '4', title: 'Tell the Story', content: '' },
        { id: '5', title: 'Gospel Connection', content: '' }
      ],
      engage: [
        { id: '6', title: 'Discuss the Story', content: '' },
        { id: '7', title: 'Activities', content: '' },
        { id: '8', title: 'Crafts', content: '' }
      ]
    });
    setActivities([]);
    setVideos([]);
    setAttachments([]);
    setDownloadLinks([]);
    setGenerationHistory([]);
    setCurrentHistoryIndex(-1);
    setAiGoal('');
    setAiStep('questions');
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (status: LessonStatus) => {
    if (!formData.title) return alert("Lesson Identity (Title) is required.");
    
    setLoading(true);
    setError(null);
    
    try {
      const finalMarkdown = serializeStructureToMarkdown();
      const { 
        activities: _a, 
        videos: _v, 
        attachments: _at, 
        progress: _p,
        ...restOfFormData 
      } = formData;

      const payload = { 
        ...restOfFormData, 
        content: finalMarkdown, 
        status, 
        created_by: user.id
      };

      if (editingId === 'new') {
        // @ts-ignore
        delete payload.id;
      }

      await db.lessons.upsert(payload, activities, videos);
      alert(`Lesson successfully ${status === LessonStatus.PUBLISHED ? 'published' : 'saved as draft'}!`);
      setEditingId(null);
      fetchLessons();
    } catch (e: any) {
      setError(`Save failed: ${e.message}`);
      alert("Save Failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiGoal.trim()) return alert("Please describe your lesson summary or objective.");
    setIsGenerating(true);
    try {
      const existingContext = lessons.map(l => l.title).join(', ');
      const result = await generateFullLesson(aiGoal, existingContext);
      if (result) {
        const newGen = {
          title: result.title,
          structure: {
            read: result.read.map((r: any) => ({ id: Math.random().toString(36).substr(2, 9), title: r.title, content: r.content })),
            teach: result.teach.map((t: any) => ({ id: Math.random().toString(36).substr(2, 9), title: t.title, content: t.content })),
            engage: result.engage.map((e: any) => ({ id: Math.random().toString(36).substr(2, 9), title: e.title, content: e.content })),
          }
        };
        const newHistory = [...generationHistory, newGen];
        setGenerationHistory(newHistory);
        setCurrentHistoryIndex(newHistory.length - 1);
        setFormData(prev => ({ ...prev, title: newGen.title }));
        setStructure(newGen.structure);
        setAiStep('preview');
      }
    } catch (e) {
      alert("AI Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAutoCategorize = async () => {
    if (!formData.title) return alert("Please enter a Lesson Identity (Title) first.");
    setIsCategorizing(true);
    try {
      const detectedCategory = await categorizeLessonTitle(formData.title);
      setFormData(prev => ({ ...prev, category: detectedCategory }));
    } catch (e) {
      console.error("AI Categorization failed", e);
    } finally {
      setIsCategorizing(false);
    }
  };

  const addSubSection = (box: keyof LessonContentStructure) => {
    setStructure(prev => ({
      ...prev,
      [box]: [...prev[box], { id: Math.random().toString(36).substr(2, 9), title: 'New Sub-section', content: '' }]
    }));
  };

  const updateSubSection = (box: keyof LessonContentStructure, id: string, updates: Partial<LessonSubSection>) => {
    setStructure(prev => ({
      ...prev,
      [box]: prev[box].map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  const deleteSubSection = (box: keyof LessonContentStructure, id: string) => {
    setStructure(prev => ({
      ...prev,
      [box]: prev[box].filter(s => s.id !== id)
    }));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* AI GENERATOR MODAL */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[48px] p-8 md:p-12 shadow-2xl space-y-8 relative overflow-hidden">
            <button onClick={() => setIsAiModalOpen(false)} className="absolute top-8 right-10 text-gray-300 hover:text-black">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-[#003882] tracking-tighter uppercase">AI Lesson Architect</h2>
              <p className="text-gray-400 font-medium">{aiStep === 'questions' ? 'Define your goal.' : 'Review your plan.'}</p>
            </div>
            {aiStep === 'questions' ? (
              <div className="space-y-6">
                <textarea rows={6} className="w-full bg-[#F8FAFC] border-2 border-transparent focus:border-[#EF4E92] rounded-[32px] px-8 py-7 outline-none transition-all font-medium resize-none text-gray-800 leading-relaxed" placeholder="Summarize your objective..." value={aiGoal} onChange={e => setAiGoal(e.target.value)} />
                <button onClick={handleAiGenerate} disabled={isGenerating} className="w-full bg-[#EF4E92] text-white rounded-full py-5 font-black uppercase tracking-widest shadow-lg hover:bg-[#EF4E92]/90 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                  {isGenerating ? 'Architecting...' : 'Generate'}
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="bg-gray-50 rounded-[32px] p-6 border border-gray-100 max-h-[30vh] overflow-y-auto">
                  <h4 className="font-black text-indigo-900 mb-2 uppercase text-[10px] tracking-[0.2em]">Live Preview</h4>
                  <p className="font-black text-lg text-gray-800">{formData.title}</p>
                </div>
                <button onClick={() => setIsAiModalOpen(false)} className="w-full bg-[#EF4E92] text-white rounded-full py-5 font-black uppercase tracking-widest shadow-lg hover:bg-[#EF4E92]/90 transition-all">Use Selected</button>
              </div>
            )}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-6 md:px-10 py-4 md:py-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-[#EF4E92] w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center font-black text-white shadow-lg shadow-pink-200">K</div>
          <div>
            <h1 className="text-xs md:text-sm font-black tracking-tight text-gray-900 uppercase">KingdomKids Admin</h1>
            <p className="hidden md:block text-[10px] text-gray-400 font-bold tracking-widest uppercase">FAITH PATHWAY</p>
          </div>
        </div>
        <button onClick={onLogout} className="text-[10px] md:text-xs font-black uppercase text-[#EF4E92] tracking-widest hover:text-[#EF4E92]/80 transition-colors">Log out</button>
      </header>

      <div className="max-w-[1600px] mx-auto p-6 md:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-16">
        {/* Sidebar */}
        <div className={`lg:col-span-3 space-y-8 ${editingId ? 'hidden lg:block' : 'block'}`}>
          <div className="flex items-center justify-between">
            <h2 className="font-black text-2xl md:text-3xl tracking-tighter text-[#003882]">Lessons</h2>
            <button onClick={handleNew} className="bg-[#EF4E92] text-white px-5 py-2.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-[#EF4E92]/90">+ NEW</button>
          </div>
          <div className="space-y-4 overflow-y-auto lg:max-h-[calc(100vh-280px)] pr-2 scrollbar-hide">
            {lessons.map(l => (
              <div key={l.id} onClick={() => handleEdit(l.id)} className={`p-5 md:p-6 rounded-[32px] border transition-all cursor-pointer relative ${editingId === l.id ? 'border-pink-500 bg-pink-50/30' : 'border-gray-50 bg-white hover:border-gray-200 shadow-sm'}`}>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-sm line-clamp-1 text-gray-800">{l.title || 'Untitled'}</h3>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{l.category}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${l.status === LessonStatus.PUBLISHED ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>{l.status}</span>
                    
                    {/* ACTION BUTTONS GROUP */}
                    <div className="flex items-center gap-2">
                      {/* PENCIL EDIT BUTTON */}
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(l.id);
                        }}
                        className="relative z-10 flex items-center justify-center w-8 h-8 border-[2px] border-gray-200 rounded-full bg-white text-gray-400 hover:text-white hover:bg-[#EF4E92] hover:border-[#EF4E92] transition-all shadow-sm"
                        title="Edit Lesson"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>

                      {/* TRASH DELETE BUTTON */}
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(e, l.id);
                        }}
                        className="relative z-10 flex items-center justify-center w-8 h-8 border-[2px] border-gray-200 rounded-full bg-white text-gray-400 hover:text-white hover:bg-red-500 hover:border-red-500 transition-all shadow-sm"
                        title="Delete Lesson"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor Area */}
        <div className={`lg:col-span-9 ${!editingId ? 'hidden lg:block' : 'block'}`}>
          {!editingId ? (
            <div className="h-[70vh] flex flex-col items-center justify-center bg-white rounded-[64px] border border-gray-100 text-gray-300 p-12 text-center shadow-sm">
              <svg className="w-20 h-20 opacity-10 mb-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              <p className="font-black uppercase tracking-[0.3em] text-[10px]">Select a lesson from the left</p>
            </div>
          ) : (
            <div className="space-y-16 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
              <div className="bg-white/95 backdrop-blur-md p-4 md:p-6 rounded-full border border-gray-100 shadow-xl flex flex-wrap items-center justify-between sticky top-[92px] z-40 gap-4">
                <h2 className="font-black text-lg md:text-2xl px-4 text-[#003882] truncate max-w-[200px]">{formData.title || 'New Lesson'}</h2>
                <div className="flex items-center gap-3">
                  {editingId !== 'new' && (
                    <button onClick={(e) => handleDelete(e, editingId!)} className="px-6 py-3 text-xs font-black uppercase text-red-500 hover:text-red-700 tracking-widest transition-colors">DELETE</button>
                  )}
                  <button onClick={() => setEditingId(null)} className="px-6 py-3 text-xs font-black uppercase text-gray-400 hover:text-black tracking-widest">DISCARD</button>
                  <button onClick={() => setIsAiModalOpen(true)} className="px-8 py-4 bg-[#EF4E92] rounded-full text-xs font-black uppercase tracking-widest text-white shadow-lg hover:scale-[1.02] transition-transform">AI ARCHITECT</button>
                  <button onClick={() => handleSave(LessonStatus.DRAFT)} className="px-10 py-4 bg-[#003882] rounded-full text-xs font-black uppercase tracking-widest text-white shadow-lg hover:scale-[1.02] transition-transform">DRAFT</button>
                  <button onClick={() => handleSave(LessonStatus.PUBLISHED)} className="px-12 py-4 bg-[#EF4E92] rounded-full text-xs font-black uppercase tracking-widest text-white shadow-lg hover:scale-[1.02] transition-transform">PUBLISH</button>
                </div>
              </div>

              {/* IDENTITY SECTION */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <SectionHeader title="Lesson Identity" />
                  <input placeholder="Ex: Genesis 1 - Creation" className="w-full bg-white border border-gray-100 rounded-[32px] px-8 py-7 font-black text-2xl text-gray-800 outline-none shadow-sm focus:border-pink-300" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="space-y-4">
                  <SectionHeader title="Category" />
                  <div className="flex gap-3">
                    <select className="flex-1 bg-white border border-gray-100 rounded-[32px] px-8 py-7 text-sm font-black appearance-none outline-none shadow-sm focus:border-pink-300" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={handleAutoCategorize} disabled={isCategorizing} className="bg-white w-20 border border-gray-100 rounded-[32px] flex items-center justify-center font-black text-[#EF4E92] shadow-sm hover:bg-gray-50">
                      {isCategorizing ? <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div> : 'AI'}
                    </button>
                  </div>
                </div>
              </div>

              {/* LESSON BODY */}
              <div className="space-y-8">
                <SectionHeader title="The Lesson Body" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  {/* Columns for Read, Teach, Engage */}
                  {(['read', 'teach', 'engage'] as const).map((col, idx) => (
                    <div key={col} className="bg-white border border-gray-100 rounded-[56px] p-10 shadow-sm flex flex-col min-h-[700px]">
                      <div className="flex items-center justify-between mb-10">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${idx === 0 ? 'bg-pink-50 text-pink-500' : idx === 1 ? 'bg-blue-50 text-blue-500' : 'bg-purple-50 text-purple-500'}`}>{idx + 1}</div>
                          <h4 className="font-black text-2xl text-gray-800 uppercase tracking-tight">{col}</h4>
                        </div>
                        <button onClick={() => addSubSection(col)} className="text-[#EF4E92] font-black text-[10px] uppercase tracking-widest">+ SUB</button>
                      </div>
                      <div className="space-y-8">
                        {structure[col].map(sub => (
                          <SubSectionCard key={sub.id} sub={sub} onUpdate={updates => updateSubSection(col, sub.id, updates)} onDelete={() => deleteSubSection(col, sub.id)} placeholder={`Content for ${col}...`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
