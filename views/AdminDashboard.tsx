
import React, { useState, useEffect } from 'react';
import { db } from '../services/supabaseService.ts';
import { categorizeLessonTitle, generateFullLesson } from '../services/geminiService.ts';
import { Lesson, LessonStatus, UserRole, Profile, LessonActivity, LessonVideo, Attachment, LessonContentStructure, LessonSubSection } from '../types.ts';

// Helper components defined outside of the main component to resolve TS prop check issues in JSX maps

const SectionHeader = ({ title }: { title: string }) => (
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

const SubSectionCard = ({ 
  sub, 
  onUpdate, 
  onDelete, 
  placeholder 
}: SubSectionCardProps) => (
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
        return {
          id: Math.random().toString(36).substr(2, 9),
          title: lines[0].trim(),
          content: lines.slice(1).join('\n').trim()
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
      setError("Failed to load lessons directory.");
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
        setDownloadLinks([]); 
        setGenerationHistory([]);
        setCurrentHistoryIndex(-1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e: any) {
      setError(`Error loading lesson: ${e.message}`);
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
      await db.lessons.upsert({ ...formData, content: finalMarkdown, status, created_by: user.id }, activities, videos);
      setEditingId(null);
      fetchLessons();
    } catch (e: any) {
      setError(`Save failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiGoal.trim()) {
      return alert("Please describe your lesson summary or objective.");
    }
    
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
        
        // Auto fill form behind the scenes
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

  const handleGenerateAgain = () => {
    if (generationHistory.length >= 3 && generationHistory.length < 5) {
      // Prompt user to refine objective after 3rd attempt
      setAiStep('questions');
    } else if (generationHistory.length >= 5) {
      alert("Maximum generations reached. Please choose from the existing versions.");
    } else {
      handleAiGenerate();
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
              <p className="text-gray-400 font-medium">
                {aiStep === 'questions' ? 'Define your goal. Who is this for and what should they achieve?' : 'Review your generated plan or propose another approach.'}
              </p>
            </div>

            {aiStep === 'questions' ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Lesson Summary & Objective</label>
                  <textarea 
                    rows={6}
                    className="w-full bg-[#F8FAFC] border-2 border-transparent focus:border-[#EF4E92] rounded-[32px] px-8 py-7 outline-none transition-all font-medium resize-none text-gray-800 leading-relaxed" 
                    placeholder="Ex: Teach grade 3 children about the Creation story in Genesis. The goal is to help them appreciate God's power and love through nature, especially those feeling lonely or small..."
                    value={aiGoal}
                    onChange={e => setAiGoal(e.target.value)}
                  />
                </div>
                
                {generationHistory.length >= 3 && (
                  <div className="bg-orange-50 border border-orange-100 p-6 rounded-[32px] animate-in slide-in-from-top-4">
                    <p className="text-orange-700 text-xs font-bold leading-relaxed text-center">
                      💡 <span className="uppercase tracking-widest">Advice:</span> To make the lesson more accurate, please make your objective more specific about the target audience and the exact spiritual impact you want to have.
                    </p>
                  </div>
                )}

                <button 
                  onClick={handleAiGenerate}
                  disabled={isGenerating}
                  className="w-full bg-[#EF4E92] text-white rounded-full py-5 font-black uppercase tracking-widest shadow-lg shadow-[#EF4E92]/20 hover:bg-[#EF4E92]/90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Architecting...
                    </>
                  ) : (
                    'Generate'
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="bg-gray-50 rounded-[32px] p-6 border border-gray-100 max-h-[30vh] overflow-y-auto scrollbar-hide">
                  <h4 className="font-black text-indigo-900 mb-2 uppercase text-[10px] tracking-[0.2em]">Live Preview</h4>
                  <p className="font-black text-lg text-gray-800">{formData.title}</p>
                  <p className="text-sm text-gray-500 mt-2 line-clamp-3 italic">Created based on: {aiGoal}</p>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={handleGenerateAgain}
                      disabled={isGenerating || generationHistory.length >= 5}
                      className="flex-1 bg-[#EF4E92] text-white rounded-full py-5 font-black uppercase tracking-widest shadow-lg shadow-[#EF4E92]/20 hover:bg-[#EF4E92]/90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {isGenerating ? 'Architecting...' : 'Propose Other Approach'}
                    </button>
                    <button 
                      onClick={() => setIsAiModalOpen(false)}
                      className="flex-1 bg-[#EF4E92] text-white rounded-full py-5 font-black uppercase tracking-widest shadow-lg hover:bg-[#EF4E92]/90 transition-all"
                    >
                      Use Selected
                    </button>
                  </div>
                  
                  <div className="flex flex-col items-center gap-3">
                     <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Version History ({generationHistory.length}/5)</p>
                     <div className="flex gap-2">
                      {generationHistory.map((gen, idx) => (
                        <button 
                          key={idx}
                          onClick={() => {
                            setCurrentHistoryIndex(idx);
                            setFormData(prev => ({ ...prev, title: gen.title }));
                            setStructure(gen.structure);
                          }}
                          className={`w-10 h-10 rounded-full font-black text-xs transition-all border-2 ${currentHistoryIndex === idx ? 'bg-[#EF4E92] text-white border-[#EF4E92]' : 'bg-white text-gray-400 border-gray-100 hover:border-pink-200'}`}
                        >
                          {idx + 1}
                        </button>
                      ))}
                     </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-100">
               <div className="h-full bg-[#EF4E92] transition-all duration-500" style={{ width: `${(generationHistory.length / 5) * 100}%` }}></div>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-6 md:px-10 py-4 md:py-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="bg-[#EF4E92] w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex items-center justify-center font-black text-lg md:text-xl text-white shadow-lg shadow-pink-200">K</div>
          <div>
            <h1 className="text-xs md:text-sm font-black tracking-tight text-gray-900">KingdomKids Admin</h1>
            <p className="hidden md:block text-[10px] text-gray-400 font-bold uppercase tracking-widest">FAITH PATHWAY</p>
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <button onClick={onLogout} className="text-[10px] md:text-xs font-black uppercase text-[#EF4E92] tracking-widest hover:text-[#EF4E92]/80 transition-colors">Log out</button>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto p-6 md:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-16">
        {/* Sidebar */}
        <div className={`lg:col-span-3 space-y-8 ${editingId ? 'hidden lg:block' : 'block'}`}>
          <div className="flex items-center justify-between">
            <h2 className="font-black text-2xl md:text-3xl tracking-tighter text-[#003882]">Lessons</h2>
            <button onClick={handleNew} className="bg-[#EF4E92] text-white px-5 py-2.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-[#EF4E92]/90">+ NEW</button>
          </div>
          <div className="space-y-4 overflow-y-auto lg:max-h-[calc(100vh-280px)] pr-2 scrollbar-hide">
            {lessons.length === 0 ? (
              <p className="text-center py-10 md:py-20 text-gray-300 font-medium italic">No lessons found.</p>
            ) : (
              lessons.map(l => (
                <div 
                  key={l.id} 
                  onClick={() => handleEdit(l.id)} 
                  className={`p-5 md:p-6 rounded-[24px] md:rounded-[32px] border transition-all cursor-pointer group ${editingId === l.id ? 'border-pink-500 bg-pink-50/30 shadow-md' : 'border-gray-50 bg-white hover:border-gray-200 shadow-sm'}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-sm line-clamp-1 text-gray-800">{l.title || 'Untitled'}</h3>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${l.status === LessonStatus.PUBLISHED ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>{l.status}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{l.category}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Editor Area */}
        <div className={`lg:col-span-9 ${!editingId ? 'hidden lg:block' : 'block'}`}>
          {!editingId ? (
            <div className="h-[70vh] flex flex-col items-center justify-center bg-white rounded-[48px] md:rounded-[64px] border border-gray-100 text-gray-300 p-12 text-center shadow-sm">
               <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-50 rounded-full flex items-center justify-center mb-8">
                <svg className="w-8 h-8 md:w-10 md:h-10 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              </div>
              <p className="font-black uppercase tracking-[0.3em] text-[10px] md:text-xs">Select a lesson from the left</p>
            </div>
          ) : (
            <div className="space-y-10 md:space-y-16 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
              <button onClick={() => setEditingId(null)} className="lg:hidden flex items-center gap-2 text-gray-400 font-bold text-xs uppercase mb-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                Back to List
              </button>

              <div className="bg-white/95 backdrop-blur-md p-4 md:p-6 rounded-[32px] md:rounded-full border border-gray-100 shadow-xl flex flex-wrap items-center justify-between sticky top-[72px] md:top-[92px] z-40 gap-4">
                <h2 className="font-black text-lg md:text-2xl px-2 md:px-4 text-[#003882] truncate max-w-[200px] md:max-w-none">
                  {editingId === 'new' ? 'New Lesson' : (formData.title || 'Refining...')}
                </h2>
                <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
                  <button onClick={() => setEditingId(null)} className="flex-1 md:flex-none px-4 md:px-6 py-3 text-[10px] md:text-xs font-black uppercase text-gray-400 hover:text-black">DISCARD</button>
                  <button onClick={() => setIsAiModalOpen(true)} className="flex-[2] md:flex-none px-6 md:px-8 py-3.5 md:py-4 bg-[#EF4E92] rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-[#EF4E92]/20 hover:scale-[1.02] transition-transform">GENERATE WITH AI</button>
                  <button onClick={() => handleSave(LessonStatus.DRAFT)} className="flex-1 md:flex-none px-4 md:px-8 py-3.5 md:py-4 bg-[#EF4E92] rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-[#EF4E92]/20">DRAFT</button>
                  <button onClick={() => handleSave(LessonStatus.PUBLISHED)} className="flex-[2] md:flex-none px-6 md:px-10 py-3.5 md:py-4 bg-[#EF4E92] rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-[#EF4E92]/20">PUBLISH</button>
                </div>
              </div>

              {/* IDENTITY SECTION */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                <div className="space-y-4">
                  <SectionHeader title="Lesson Identity" />
                  <div className="bg-white rounded-[32px] md:rounded-[48px] p-5 md:p-6 shadow-sm border border-gray-50">
                    <input 
                      placeholder="Ex: Genesis 1 - Creation" 
                      className="w-full bg-[#F8FAFC] border-none rounded-[20px] md:rounded-[32px] px-6 py-5 md:px-8 md:py-7 font-black text-xl md:text-2xl text-gray-800 outline-none" 
                      value={formData.title} 
                      onChange={e => setFormData({...formData, title: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <SectionHeader title="Category" />
                  <div className="bg-white rounded-[32px] md:rounded-[48px] p-5 md:p-6 shadow-sm border border-gray-50 flex gap-3">
                    <div className="flex-1 relative">
                      <select 
                        className="w-full bg-[#F8FAFC] border-2 border-black rounded-[20px] md:rounded-[24px] px-6 py-5 md:px-8 md:py-7 text-xs md:text-sm font-black appearance-none" 
                        value={formData.category} 
                        onChange={e => setFormData({...formData, category: e.target.value})}
                      >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <button 
                      onClick={handleAutoCategorize} 
                      disabled={isCategorizing}
                      title="AI-Driven Categorization"
                      className="bg-white hover:bg-gray-50 w-16 md:w-20 border border-gray-200 rounded-[20px] md:rounded-[24px] flex items-center justify-center font-black text-[#EF4E92] transition-all disabled:opacity-50"
                    >
                      {isCategorizing ? (
                        <div className="w-5 h-5 border-2 border-[#EF4E92] border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <span className="text-xs font-black uppercase tracking-tighter">AI</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* LESSON BODY GRID */}
              <div className="space-y-8">
                <SectionHeader title="The Lesson Body" />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-10">
                  {/* Read Column */}
                  <div className="bg-white border border-gray-50 rounded-[40px] md:rounded-[56px] p-6 md:p-10 shadow-sm flex flex-col min-h-[600px] md:min-h-[800px]">
                    <div className="flex items-center justify-between mb-8 md:mb-10">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-pink-50 rounded-full flex items-center justify-center text-[#EF4E92] font-black text-xs md:text-sm">1</div>
                        <h4 className="font-black text-xl md:text-2xl text-gray-800">Read</h4>
                      </div>
                      <button onClick={() => addSubSection('read')} className="text-[#EF4E92] font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em]">+ SUB</button>
                    </div>
                    <div className="space-y-6 md:space-y-8">
                      {structure.read.map(sub => (
                        <SubSectionCard 
                          key={sub.id} 
                          sub={sub} 
                          onUpdate={updates => updateSubSection('read', sub.id, updates)}
                          onDelete={() => deleteSubSection('read', sub.id)}
                          placeholder="Add text here"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Teach Column */}
                  <div className="bg-white border border-gray-50 rounded-[40px] md:rounded-[56px] p-6 md:p-10 shadow-sm flex flex-col min-h-[600px] md:min-h-[800px]">
                    <div className="flex items-center justify-between mb-8 md:mb-10">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-50 rounded-full flex items-center justify-center text-[#5A67D8] font-black text-xs md:text-sm">2</div>
                        <h4 className="font-black text-xl md:text-2xl text-gray-800">Teach</h4>
                      </div>
                      <button onClick={() => addSubSection('teach')} className="text-[#5A67D8] font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em]">+ SUB</button>
                    </div>
                    <div className="space-y-6 md:space-y-8">
                      {structure.teach.map(sub => (
                        <SubSectionCard 
                          key={sub.id} 
                          sub={sub} 
                          onUpdate={updates => updateSubSection('teach', sub.id, updates)}
                          onDelete={() => deleteSubSection('teach', sub.id)}
                          placeholder="Add text here"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Engage Column */}
                  <div className="bg-white border border-gray-50 rounded-[40px] md:rounded-[56px] p-6 md:p-10 shadow-sm flex flex-col min-h-[600px] md:min-h-[800px]">
                    <div className="flex items-center justify-between mb-8 md:mb-10">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-purple-50 rounded-full flex items-center justify-center text-[#9F7AEA] font-black text-xs md:text-sm">3</div>
                        <h4 className="font-black text-xl md:text-2xl text-gray-800">Engage</h4>
                      </div>
                      <button onClick={() => addSubSection('engage')} className="text-[#9F7AEA] font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em]">+ SUB</button>
                    </div>
                    <div className="space-y-6 md:space-y-8">
                      {structure.engage.map(sub => (
                        <SubSectionCard 
                          key={sub.id} 
                          sub={sub} 
                          onUpdate={updates => updateSubSection('engage', sub.id, updates)}
                          onDelete={() => deleteSubSection('engage', sub.id)}
                          placeholder="Add text here"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTIVITIES SECTION */}
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <SectionHeader title="Interactive Activities" />
                  <button onClick={() => setActivities([...activities, { title: '', instructions: '', supplies: [], duration_minutes: 15 }])} className="bg-[#EF4E92] text-white px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-pink-200 hover:bg-[#EF4E92]/90 transition-all">+ ADD ACTIVITY</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                  {activities.map((act, idx) => (
                    <div key={idx} className="bg-white border border-gray-50 rounded-[40px] md:rounded-[56px] p-8 md:p-10 shadow-sm space-y-6 relative group">
                      <button onClick={() => setActivities(activities.filter((_, i) => i !== idx))} className="absolute top-8 right-8 text-gray-300 hover:text-red-500 font-bold text-[10px]">DELETE</button>
                      <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">ACTIVITY NAME</label>
                        <input className="text-lg font-black w-full bg-[#F8FAFC] rounded-2xl px-6 py-4 border-none outline-none focus:ring-1 focus:ring-pink-500/20" value={act.title} onChange={e => {
                          const n = [...activities]; n[idx].title = e.target.value; setActivities(n);
                        }} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">INSTRUCTIONS</label>
                        <div className="bg-[#F8FAFC] rounded-[24px] p-2 border border-gray-50">
                          <textarea className="w-full bg-transparent border-none p-4 text-sm min-h-[120px] resize-none outline-none" value={act.instructions} onChange={e => {
                            const n = [...activities]; n[idx].instructions = e.target.value; setActivities(n);
                          }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* MULTIMEDIA SECTION */}
              <div className="space-y-8">
                <SectionHeader title="Multimedia & Assets" />
                <div className="bg-white rounded-[40px] md:rounded-[56px] p-8 md:p-12 shadow-sm border border-gray-100 grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-12">
                   {/* Video Links */}
                   <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest uppercase">VIDEO LINKS</p>
                        <button onClick={() => setVideos([...videos, { url: '', provider: 'youtube', sort_order: videos.length }])} className="text-[#EF4E92] text-[10px] font-black uppercase tracking-widest">+ ADD URL</button>
                      </div>
                      <div className="space-y-3">
                        {videos.map((v, i) => (
                          <div key={i} className="flex gap-2 bg-[#F8FAFC] p-2 rounded-2xl border border-gray-100">
                            <input className="flex-1 bg-transparent border-none px-4 py-3 text-sm font-medium outline-none text-gray-700" value={v.url} placeholder="YouTube or Vimeo URL..." onChange={e => {
                              const n = [...videos]; n[i].url = e.target.value; setVideos(n);
                            }} />
                            <button onClick={() => setVideos(videos.filter((_, idx) => idx !== i))} className="px-4 text-gray-300 hover:text-red-500">✕</button>
                          </div>
                        ))}
                      </div>
                   </div>
                   {/* Downloadable Links */}
                   <div className="space-y-6 lg:border-l lg:border-gray-50 lg:pl-12">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest uppercase">DOWNLOADABLES LINKS</p>
                        <button onClick={() => setDownloadLinks([...downloadLinks, {name: '', url: ''}])} className="text-[#EF4E92] text-[10px] font-black uppercase tracking-widest">+ ADD LINK</button>
                      </div>
                      <div className="space-y-3">
                        {downloadLinks.map((link, i) => (
                          <div key={i} className="flex gap-2 bg-[#F8FAFC] p-2 rounded-2xl border border-gray-100">
                            <input className="flex-1 bg-transparent border-none px-4 py-3 text-sm font-medium outline-none text-gray-700" value={link.url} placeholder="File or Resource URL..." onChange={e => {
                              const n = [...downloadLinks]; n[i].url = e.target.value; setDownloadLinks(n);
                            }} />
                            <button onClick={() => setDownloadLinks(downloadLinks.filter((_, idx) => idx !== i))} className="px-4 text-gray-300 hover:text-red-500">✕</button>
                          </div>
                        ))}
                      </div>
                   </div>
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
