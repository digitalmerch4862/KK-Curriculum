
import React, { useState, useEffect } from 'react';
import { db } from '../services/supabaseService.ts';
import { categorizeLessonTitle, generateFullLesson, generateLessonSummary } from '../services/geminiService.ts';
import { Lesson, LessonStatus, UserRole, Profile, LessonActivity, LessonVideo, Attachment, LessonContentStructure, LessonSubSection } from '../types.ts';

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

  const isBibleCard = sub.title.toLowerCase().includes('bible text') || sub.title.toLowerCase().includes('scripture');

  const fetchBibleText = async () => {
    const sanitizedQuery = bibleReference.trim().replace(/–|—/g, '-');
   
    if (!sanitizedQuery) {
      return alert("Please enter a reference (e.g. Genesis 1-2 or John 3:16)");
    }

    setIsFetching(true);
    try {
      const res = await fetch(`https://bible-api.com/${encodeURIComponent(sanitizedQuery)}`);
     
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Reference "${sanitizedQuery}" not found. Please check spelling.`);
        }
        throw new Error("Failed to connect to the Bible API.");
      }
     
      const data = await res.json();
     
      if (data && data.text) {
        onUpdate({ content: data.text.trim() });
      } else {
        throw new Error(`Reference "${sanitizedQuery}" not found.`);
      }
    } catch (e: any) {
      console.error("Bible Fetch Error:", e);
      alert(e.message || "Failed to fetch Bible text. Please check your internet connection.");
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="bg-white p-5 md:p-6 rounded-[30px] relative shadow-sm border-2 border-transparent hover:border-pink-50 transition-all group flex flex-col min-h-[160px]">
      {!isBibleCard && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-4 right-6 text-gray-300 hover:text-red-500 transition-colors z-10"
          aria-label="Delete section"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
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
        <div className="mb-4">
          <div className="flex flex-col gap-2">
            <div className="relative">
              <input
                type="text"
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-xs focus:border-[#EF4E92] outline-none transition-all font-medium"
                placeholder="Reference (e.g. Genesis 1-2)"
                value={bibleReference}
                onChange={e => setBibleReference(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchBibleText()}
              />
            </div>
            <button
              onClick={fetchBibleText}
              disabled={isFetching}
              className="w-full h-10 bg-[#003882] text-white rounded-xl flex items-center justify-center gap-2 hover:bg-[#003882]/90 disabled:opacity-50 transition-all shadow-sm font-black uppercase tracking-widest text-[9px]"
            >
              {isFetching ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Fetch Verses</span>
                </>
              )}
            </button>
          </div>
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
    { id: 'tpl-r1', title: 'Scripture', content: '' },
    { id: 'tpl-r2', title: 'Objective', content: '' },
    { id: 'tpl-r3', title: 'The Hook', content: '' }
  ],
  teach: [
    { id: 'tpl-t1', title: 'Point 1', content: '' },
    { id: 'tpl-t2', title: 'Point 2', content: '' },
    { id: 'tpl-t3', title: 'Point 3', content: '' }
  ],
  engage: [
    { id: 'tpl-e1', title: 'Group Activity', content: '' },
    { id: 'tpl-e2', title: 'Closing Prayer', content: '' }
  ]
};

interface AdminDashboardProps {
  user: Profile;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Lesson>>({
    title: '', summary: '', content: '', category: 'HISTORY', series: '', grade_min: 1, grade_max: 5, tags: [], status: LessonStatus.DRAFT
  });
 
  const [structure, setStructure] = useState<LessonContentStructure>({
    read: [],
    teach: [],
    engage: []
  });

  const categories = [
    'PENTATEUCH',
    'HISTORY',
    'POETRY',
    'THE PROPHETS',
    'THE GOSPELS',
    'ACTS & EPISTLES',
    'REVELATION'
  ];

  const [activities, setActivities] = useState<Partial<LessonActivity>[]>([]);
  const [videos, setVideos] = useState<Partial<LessonVideo>[]>([]);
  const [attachments, setAttachments] = useState<Partial<Attachment>[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiStep, setAiStep] = useState<'questions' | 'preview'>('questions');
  const [aiGoal, setAiGoal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchLessons();
  }, []);

  const parseMarkdownToStructure = (md: string) => {
    const newStructure: LessonContentStructure = { read: [], teach: [], engage: [] };
    if (!md) return newStructure;

    const mainSections = md.split(/^# \d\. /m);
   
    ['read', 'teach', 'engage'].forEach((key, i) => {
      const fullBlock = mainSections[i + 1] || '';
      const parts = fullBlock.split(/^## /m);
      const subSections = parts.slice(1).filter(s => s.trim());
     
      (newStructure as any)[key] = subSections.map(s => {
        const lines = s.split('\n');
        const title = lines[0].trim();
        const content = lines.slice(1).join('\n').trim();
        return {
          id: Math.random().toString(36).substr(2, 9),
          title: title || 'Block',
          content: content || ''
        };
      });
    });
    return newStructure;
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
       
        const parsedStructure = parseMarkdownToStructure(full.content || '');
        setStructure(parsedStructure);
       
        setActivities(full.activities || []);
        setVideos(full.videos || []);
        setAttachments(full.attachments || []);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e: any) {
      setError(`Error loading lesson: ${e.message}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to permanently delete this lesson?")) return;
   
    setLoading(true);
    try {
      await db.lessons.delete(id);
      if (editingId === id) setEditingId(null);
      await fetchLessons();
    } catch (e: any) {
      alert("Delete failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setEditingId('new');
    setFormData({
      title: '', summary: '', content: '', category: 'HISTORY', series: '', grade_min: 1, grade_max: 5, tags: [], status: LessonStatus.DRAFT
    });
   
    const freshTemplate: LessonContentStructure = {
      read: DEFAULT_LESSON_TEMPLATE.read.map(item => ({ ...item, id: Math.random().toString(36).substr(2, 9) })),
      teach: DEFAULT_LESSON_TEMPLATE.teach.map(item => ({ ...item, id: Math.random().toString(36).substr(2, 9) })),
      engage: DEFAULT_LESSON_TEMPLATE.engage.map(item => ({ ...item, id: Math.random().toString(36).substr(2, 9) }))
    };
   
    setStructure(freshTemplate);
    setActivities([]);
    setVideos([]);
    setAttachments([]);
    setAiGoal('');
    setAiStep('questions');
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (status: LessonStatus) => {
    if (!formData.title) return alert("Lesson Title is required.");
   
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

      await db.lessons.upsert(payload, activities, videos, attachments);
      alert(`Lesson ${status === LessonStatus.PUBLISHED ? 'published' : 'saved'} successfully!`);
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
    if (!aiGoal.trim()) return alert("Please describe your lesson objective.");
    setIsGenerating(true);
    try {
      const existingContext = lessons.map(l => l.title).join(', ');
      const result = await generateFullLesson(aiGoal, existingContext);
      if (result) {
        // Map new AI Architect schema to existing UI 3-column structure
        const newGenStructure: LessonContentStructure = {
          read: [
            { id: Math.random().toString(36).substr(2, 9), title: 'Scripture', content: result.scripture },
            { id: Math.random().toString(36).substr(2, 9), title: 'Objective', content: result.objective },
            { id: Math.random().toString(36).substr(2, 9), title: 'The Hook', content: result.the_hook }
          ],
          teach: result.the_lesson.map((point: string, i: number) => ({
            id: Math.random().toString(36).substr(2, 9),
            title: `Point ${i + 1}`,
            content: point
          })),
          engage: [
            { id: Math.random().toString(36).substr(2, 9), title: 'Group Activity', content: result.group_activity },
            { id: Math.random().toString(36).substr(2, 9), title: 'Closing Prayer', content: result.closing_prayer }
          ],
        };

        // Combine objective and scripture for a smart initial summary
        const autoSummary = `${result.objective} Base Scripture: ${result.scripture}`;
        
        setFormData(prev => ({ ...prev, title: result.title, summary: autoSummary }));
        setStructure(newGenStructure);
        setAiStep('preview');
      }
    } catch (e) {
      console.error("AI Generation failed", e);
      alert("AI Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAutoCategorize = async () => {
    if (!formData.title) return alert("Please enter a Lesson Title first.");
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

  const handleAutoSummarize = async () => {
    const content = serializeStructureToMarkdown();
    if (content.length < 50) return alert("Please add more lesson body content before summarizing.");
    setIsSummarizing(true);
    try {
      const result = await generateLessonSummary(content);
      if (result) {
        setFormData(prev => ({ ...prev, summary: result }));
      }
    } catch (e) {
      console.error("AI Summary failed", e);
    } finally {
      setIsSummarizing(false);
    }
  };

  const addSubSection = (box: keyof LessonContentStructure) => {
    setStructure(prev => ({
      ...prev,
      [box]: [...prev[box], { id: Math.random().toString(36).substr(2, 9), title: 'New Label', content: '' }]
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
          <div className="bg-white w-full h-auto max-w-2xl rounded-[48px] p-8 md:p-12 shadow-2xl space-y-8 relative overflow-hidden">
            <button onClick={() => setIsAiModalOpen(false)} className="absolute top-8 right-10 text-gray-300 hover:text-black">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-[#003882] tracking-tighter uppercase">AI Lesson Architect</h2>
              <p className="text-gray-400 font-medium">{aiStep === 'questions' ? 'Define your objective.' : 'Review generated draft.'}</p>
            </div>
            {aiStep === 'questions' ? (
              <div className="space-y-6">
                <textarea rows={6} className="w-full bg-[#F8FAFC] border-2 border-transparent focus:border-[#EF4E92] rounded-[32px] px-8 py-7 outline-none transition-all font-medium resize-none text-gray-800 leading-relaxed" placeholder="Tell the Architect what you want to teach today..." value={aiGoal} onChange={e => setAiGoal(e.target.value)} />
                <button onClick={handleAiGenerate} disabled={isGenerating} className="w-full bg-[#EF4E92] text-white rounded-full py-5 font-black uppercase tracking-widest shadow-lg hover:bg-[#EF4E92]/90 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                  {isGenerating ? 'Architecting...' : 'Start Building'}
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="bg-gray-50 rounded-[32px] p-6 border border-gray-100 max-h-[30vh] overflow-y-auto">
                  <h4 className="font-black text-indigo-900 mb-2 uppercase text-[10px] tracking-[0.2em]">Live Preview</h4>
                  <p className="font-black text-lg text-gray-800">{formData.title}</p>
                  <p className="text-sm text-gray-400 mt-2 italic">{formData.summary}</p>
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

      <div className="max-w-[1600px] mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
        <div className={`lg:col-span-3 space-y-6 ${editingId ? 'hidden lg:block' : 'block'}`}>
          <div className="flex items-center justify-between">
            <h2 className="font-black text-2xl md:text-3xl tracking-tighter text-[#003882]">Lessons</h2>
            <button onClick={handleNew} className="bg-[#EF4E92] text-white px-5 py-2.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-[#EF4E92]/90 transition-all">+ NEW</button>
          </div>
          <div className="space-y-4 overflow-y-auto lg:max-h-[calc(100vh-220px)] pr-2 scrollbar-hide">
            {lessons.map(l => (
              <div key={l.id} onClick={() => handleEdit(l.id)} className={`p-4 md:p-5 rounded-[28px] border transition-all cursor-pointer relative flex flex-col ${editingId === l.id ? 'border-pink-500 bg-pink-50/30' : 'border-gray-50 bg-white hover:border-gray-200 shadow-sm'}`}>
                <h3 className="font-bold text-sm line-clamp-1 text-gray-800 mb-1">{l.title || 'Untitled'}</h3>
                {l.summary && (
                  <p className="text-[10px] text-gray-500 line-clamp-2 italic mb-3 leading-relaxed">
                    {l.summary}
                  </p>
                )}
                <div className="flex items-center justify-between mt-auto">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{l.category}</p>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${l.status === LessonStatus.PUBLISHED ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>{l.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`lg:col-span-9 ${!editingId ? 'hidden lg:block' : 'block'}`}>
          {!editingId ? (
            <div className="h-[70vh] flex flex-col items-center justify-center bg-white rounded-[64px] border border-gray-100 text-gray-300 p-12 text-center shadow-sm">
              <svg className="w-20 h-20 opacity-10 mb-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              <p className="font-black uppercase tracking-[0.3em] text-[10px]">Select or Create a lesson</p>
            </div>
          ) : (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
              <div className="bg-white/95 backdrop-blur-md p-3 md:p-4 rounded-full border border-gray-100 shadow-xl flex flex-wrap items-center justify-between sticky top-[92px] z-40 gap-3">
                <h2 className="font-black text-md md:text-xl px-4 text-[#003882] truncate max-w-[200px]">{formData.title || 'Draft Lesson'}</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingId(null)} className="px-4 py-2 text-[10px] font-black uppercase text-gray-400 hover:text-black tracking-widest">DISCARD</button>
                  <button onClick={() => setIsAiModalOpen(true)} className="px-5 py-3 bg-[#EF4E92] rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg hover:scale-[1.02] transition-transform">AI ARCHITECT</button>
                  <button onClick={() => handleSave(LessonStatus.DRAFT)} className="px-6 py-3 bg-[#003882] rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-transform hover:scale-[1.02]">DRAFT</button>
                  <button onClick={() => handleSave(LessonStatus.PUBLISHED)} className="px-8 py-3 bg-[#EF4E92] rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-transform hover:scale-[1.02]">PUBLISH</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <SectionHeader title="Mission Name" />
                  <input placeholder="Mission Name..." className="w-full bg-white border border-gray-100 rounded-[28px] px-6 py-5 font-black text-xl text-gray-800 outline-none shadow-sm focus:border-pink-300 transition-all" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <SectionHeader title="Classification" />
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <select
                        className="w-full bg-white border border-gray-100 rounded-[28px] px-6 py-5 text-xs font-black appearance-none outline-none shadow-sm focus:border-pink-300 transition-all cursor-pointer"
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                      >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <button
                      onClick={handleAutoCategorize}
                      disabled={isCategorizing}
                      className="shrink-0 w-14 h-14 bg-white border border-gray-100 rounded-full flex items-center justify-center font-black text-[#EF4E92] shadow-sm hover:scale-110 active:scale-95 transition-all"
                      title="AI Classification"
                    >
                      {isCategorizing ? <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div> : "AI"}
                    </button>
                  </div>
                </div>
              </div>

              {/* MISSION SUMMARY BLOCK */}
              <div className="space-y-3">
                <SectionHeader title="Mission Briefing (Summary)" />
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <textarea 
                      placeholder="Brief overview for the mission team..." 
                      className="w-full bg-white border border-gray-100 rounded-[32px] px-8 py-6 font-medium text-sm text-gray-600 outline-none shadow-sm focus:border-pink-300 transition-all resize-none min-h-[120px] leading-relaxed italic" 
                      value={formData.summary} 
                      onChange={e => setFormData({...formData, summary: e.target.value})} 
                    />
                  </div>
                  <button
                    onClick={handleAutoSummarize}
                    disabled={isSummarizing}
                    className="shrink-0 md:w-16 h-16 md:h-auto bg-white border border-gray-100 rounded-[32px] flex flex-col items-center justify-center font-black text-[#EF4E92] shadow-sm hover:scale-105 active:scale-95 transition-all p-4 gap-2 border-dashed border-2"
                    title="AI Mission Briefing"
                  >
                    {isSummarizing ? (
                      <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="text-[8px] uppercase tracking-widest hidden md:block">AI Brief</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <SectionHeader title="Lesson Body" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  {(['read', 'teach', 'engage'] as const).map((col) => (
                    <div key={col} className="bg-gray-50/60 rounded-[48px] p-6 md:p-8 flex flex-col min-h-[500px] border border-gray-100/50">
                      <div className="flex items-center justify-between mb-6 px-3">
                        <h4 className="font-black text-[10px] md:text-xs text-[#003882] uppercase tracking-[0.2em]">{col}</h4>
                        <button onClick={() => addSubSection(col)} className="text-gray-300 hover:text-[#EF4E92] transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        </button>
                      </div>
                      <div className="space-y-4">
                        {structure[col].map(sub => (
                          <SubSectionCard key={sub.id} sub={sub} onUpdate={updates => updateSubSection(col, sub.id, updates)} onDelete={() => deleteSubSection(col, sub.id)} placeholder={`Content for ${sub.title}...`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <SectionHeader title="Interactive Activities" />
                <button
                  onClick={() => setActivities([...activities, { title: '', instructions: '', supplies: [], duration_minutes: 15 }])}
                  className="bg-[#EF4E92] text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#EF4E92]/90 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ADD ACTIVITY
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {activities.map((act, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 rounded-[40px] p-8 shadow-sm space-y-4 relative">
                      <button
                        onClick={() => setActivities(activities.filter((_, i) => i !== idx))}
                        className="absolute top-8 right-8 text-gray-300 hover:text-red-500 transition-colors"
                        aria-label="Remove activity"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <input placeholder="Activity Title" className="text-lg font-black w-full bg-gray-50 rounded-xl px-5 py-3 border-none outline-none" value={act.title} onChange={e => {
                        const n = [...activities]; n[idx].title = e.target.value; setActivities(n);
                      }} />
                      <textarea placeholder="Step-by-step instructions..." className="w-full bg-gray-50 rounded-xl p-5 text-xs min-h-[120px] resize-none outline-none font-medium leading-relaxed" value={act.instructions} onChange={e => {
                        const n = [...activities]; n[idx].instructions = e.target.value; setActivities(n);
                      }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <SectionHeader title="Videos & Media" />
                <button onClick={() => setVideos([...videos, { title: '', url: '', provider: 'youtube' }])} className="bg-[#003882] text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#003882]/90 transition-all">+ ADD VIDEO</button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {videos.map((vid, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 rounded-[40px] p-8 shadow-sm space-y-4 relative">
                      <button
                        onClick={() => setVideos(videos.filter((_, i) => i !== idx))}
                        className="absolute top-8 right-8 text-gray-300 hover:text-red-500 transition-colors"
                        aria-label="Remove video"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <input placeholder="Video Title" className="text-xs font-bold w-full bg-gray-50 rounded-xl px-5 py-3 border-none outline-none" value={vid.title} onChange={e => {
                        const n = [...videos]; n[idx].title = e.target.value; setVideos(n);
                      }} />
                      <input placeholder="YouTube or Vimeo URL" className="text-xs font-medium w-full bg-gray-50 rounded-xl px-5 py-3 border-none outline-none text-blue-600" value={vid.url} onChange={e => {
                        const n = [...videos]; n[idx].url = e.target.value; setVideos(n);
                      }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <SectionHeader title="Resources & Downloads" />
                <button onClick={() => setAttachments([...attachments, { name: '', storage_path: '', type: 'pdf' }])} className="bg-[#EF4E92] text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#EF4E92]/90 transition-all">+ ADD RESOURCE</button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 rounded-[40px] p-8 shadow-sm space-y-4 relative">
                      <button
                        onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                        className="absolute top-8 right-8 text-gray-300 hover:text-red-500 transition-colors"
                        aria-label="Remove resource"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <input placeholder="Resource Name (e.g. Coloring Sheet)" className="text-xs font-bold w-full bg-gray-50 rounded-xl px-5 py-3 border-none outline-none" value={att.name || ''} onChange={e => {
                        const n = [...attachments]; n[idx].name = e.target.value; setAttachments(n);
                      }} />
                      <input placeholder="URL to PDF/Image" className="text-xs font-medium w-full bg-gray-50 rounded-xl px-5 py-3 border-none outline-none text-blue-600" value={att.storage_path || ''} onChange={e => {
                        const n = [...attachments]; n[idx].storage_path = e.target.value; setAttachments(n);
                      }} />
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
