
import React, { useState, useEffect } from 'react';
import { db } from '../services/supabaseService.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { categorizeLessonTitle, generateFullLesson } from '../services/geminiService.ts';
import { Lesson, LessonStatus, UserRole, Profile, LessonActivity, LessonVideo, LessonContentStructure, LessonSubSection } from '../types.ts';

// Helper components
const SectionHeader = ({ title }: { title: string }) => (
  <div className="flex items-center gap-3 mb-6 md:mb-8">
    <div className="h-5 md:h-6 w-1 md:w-1.5 bg-[#EF4E92] rounded-full"></div>
    <h3 className="font-black text-lg md:text-xl tracking-tight uppercase text-[#003882]">{title}</h3>
  </div>
);

const SubSectionCard = ({ 
  sub, 
  onUpdate, 
  onDelete, 
  placeholder 
}: {
  sub: LessonSubSection;
  onUpdate: (updates: Partial<LessonSubSection>) => void;
  onDelete: () => void;
  placeholder: string;
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
        rows={8} 
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
  const [activeTab, setActiveTab] = useState<'lessons' | 'forge'>('lessons');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Lesson>>({
    title: '', summary: '', content: '', category: 'History', series: '', grade_min: 1, grade_max: 5, tags: [], status: LessonStatus.DRAFT
  });
  
  const [structure, setStructure] = useState<LessonContentStructure>({
    read: [], teach: [], engage: []
  });

  const [activities, setActivities] = useState<Partial<LessonActivity>[]>([]);
  const [videos, setVideos] = useState<Partial<LessonVideo>[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);

  // SQL Editor States
  const [sqlQuery, setSqlQuery] = useState('-- Select all lessons\nSELECT * FROM lessons ORDER BY created_at DESC;');
  const [sqlResults, setSqlResults] = useState<any[] | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const sqlTemplates = [
    { name: 'All Lessons', query: 'SELECT * FROM lessons ORDER BY created_at DESC;' },
    { name: 'Active Teachers', query: 'SELECT name, role FROM profiles WHERE role = \'teacher\';' },
    { name: 'Activity Log', query: 'SELECT l.title, p.completed_at FROM lesson_progress p JOIN lessons l ON p.lesson_id = l.id;' },
    { name: 'Category Breakdown', query: 'SELECT category, count(*) FROM lessons GROUP BY category;' }
  ];

  useEffect(() => { fetchLessons(); }, []);

  const fetchLessons = async () => {
    try {
      const data = await db.lessons.list(UserRole.ADMIN);
      setLessons(data);
    } catch (e) { console.error(e); }
  };

  const handleRunSql = async () => {
    setIsExecuting(true);
    setSqlError(null);
    setSqlResults(null);
    try {
      // Calling the custom exec_sql RPC created in Supabase Dashboard
      const { data, error: rpcError } = await supabase.rpc('exec_sql', { sql_query: sqlQuery });
      if (rpcError) throw rpcError;
      setSqlResults(data || []);
    } catch (err: any) {
      setSqlError(err.message || "Execution error.");
    } finally {
      setIsExecuting(false);
    }
  };

  const parseMarkdownToStructure = (md: string) => {
    const newStructure: LessonContentStructure = { read: [], teach: [], engage: [] };
    const mainSections = md.split(/^# \d\. /m);
    ['read', 'teach', 'engage'].forEach((key, i) => {
      const sectionContent = mainSections[i + 1] || '';
      const subSections = sectionContent.split(/^## /m).filter(s => s.trim());
      (newStructure as any)[key] = subSections.map(s => {
        const lines = s.split('\n');
        return { id: Math.random().toString(36).substr(2, 9), title: lines[0].trim(), content: lines.slice(1).join('\n').trim() };
      });
    });
    setStructure(newStructure);
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
        setActivities(full.activities || []);
        setVideos(full.videos || []);
        parseMarkdownToStructure(full.content || '');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) { console.error(e); }
  };

  const handleNew = () => {
    setEditingId('new');
    setFormData({ title: '', summary: '', category: 'History', status: LessonStatus.DRAFT });
    setStructure({
      read: [{ id: '1', title: 'Bible Text', content: '' }],
      teach: [{ id: '2', title: 'The Big Picture', content: '' }],
      engage: [{ id: '3', title: 'Discussion', content: '' }]
    });
    setActivities([]);
    setVideos([]);
  };

  const handleSave = async (status: LessonStatus) => {
    if (!formData.title) return alert("Title required.");
    setLoading(true);
    try {
      const finalContent = serializeStructureToMarkdown();
      await db.lessons.upsert({ ...formData, content: finalContent, status, created_by: user.id }, activities, videos);
      setEditingId(null);
      fetchLessons();
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  };

  // AI Architect
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiGoal, setAiGoal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAiGenerate = async () => {
    if (!aiGoal.trim()) return alert("Goal required.");
    setIsGenerating(true);
    try {
      const result = await generateFullLesson(aiGoal, lessons.map(l => l.title).join(', '));
      if (result) {
        setFormData(prev => ({ ...prev, title: result.title }));
        setStructure({
          read: result.read.map((r: any) => ({ id: Math.random().toString(36).substr(2, 9), title: r.title, content: r.content })),
          teach: result.teach.map((t: any) => ({ id: Math.random().toString(36).substr(2, 9), title: t.title, content: t.content })),
          engage: result.engage.map((e: any) => ({ id: Math.random().toString(36).substr(2, 9), title: e.title, content: e.content })),
        });
        setIsAiModalOpen(false);
      }
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* AI MODAL */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-[48px] p-10 shadow-2xl space-y-8">
            <h2 className="text-2xl font-black text-[#003882] uppercase">AI Lesson Architect</h2>
            <textarea 
              rows={5}
              className="w-full bg-[#F8FAFC] border-2 border-transparent focus:border-[#EF4E92] rounded-[32px] px-8 py-6 outline-none transition-all font-medium" 
              placeholder="Ex: Teach grade 3 children about the Creation story in Genesis..."
              value={aiGoal}
              onChange={e => setAiGoal(e.target.value)}
            />
            <div className="flex gap-4">
              <button onClick={() => setIsAiModalOpen(false)} className="flex-1 py-4 font-black uppercase text-gray-400">Cancel</button>
              <button 
                onClick={handleAiGenerate}
                disabled={isGenerating}
                className="flex-1 bg-[#EF4E92] text-white rounded-full py-4 font-black uppercase shadow-lg disabled:opacity-50"
              >
                {isGenerating ? 'Architecting...' : 'Build Lesson'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-6 md:px-10 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-[#EF4E92] w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white shadow-lg">K</div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-black text-gray-900 leading-tight">KingdomKids Admin</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">FAITH PATHWAY</p>
          </div>
        </div>

        <nav className="flex items-center bg-gray-50 rounded-full p-1 gap-1">
          <button 
            onClick={() => setActiveTab('lessons')}
            className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'lessons' ? 'bg-white text-[#EF4E92] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Lessons
          </button>
          <button 
            onClick={() => setActiveTab('forge')}
            className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'forge' ? 'bg-white text-[#EF4E92] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            SQL Forge
          </button>
        </nav>

        <button onClick={onLogout} className="text-[10px] font-black uppercase text-[#EF4E92] tracking-widest">Logout</button>
      </header>

      <div className="max-w-[1600px] mx-auto p-6 md:p-12">
        {activeTab === 'lessons' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Sidebar */}
            <div className={`lg:col-span-3 space-y-8 ${editingId ? 'hidden lg:block' : 'block'}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-black text-2xl tracking-tighter text-[#003882]">Library</h2>
                <button onClick={handleNew} className="bg-[#EF4E92] text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">+ NEW</button>
              </div>
              <div className="space-y-4 overflow-y-auto lg:max-h-[70vh] pr-2 scrollbar-hide">
                {lessons.map(l => (
                  <div key={l.id} onClick={() => handleEdit(l.id)} className={`p-6 rounded-[32px] border transition-all cursor-pointer ${editingId === l.id ? 'border-[#EF4E92] bg-pink-50/20' : 'bg-white border-transparent hover:border-gray-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-sm text-gray-800 line-clamp-1">{l.title}</h3>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${l.status === LessonStatus.PUBLISHED ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>{l.status}</span>
                    </div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{l.category}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Editor */}
            <div className={`lg:col-span-9 ${!editingId ? 'hidden lg:block' : 'block'}`}>
              {!editingId ? (
                <div className="h-[60vh] flex flex-col items-center justify-center bg-white rounded-[64px] border border-gray-100 text-gray-300 shadow-sm">
                  <p className="font-black uppercase tracking-widest text-xs">Select a lesson to begin</p>
                </div>
              ) : (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white/90 backdrop-blur-md p-4 rounded-full border border-gray-100 shadow-xl flex items-center justify-between sticky top-[100px] z-40 px-8">
                    <h2 className="font-black text-xl text-[#003882] truncate max-w-[300px]">{formData.title || 'New Draft'}</h2>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingId(null)} className="px-6 py-3 text-[10px] font-black uppercase text-gray-400">Discard</button>
                      <button onClick={() => setIsAiModalOpen(true)} className="bg-[#EF4E92] text-white px-8 py-3 rounded-full text-[10px] font-black uppercase">AI Architect</button>
                      <button onClick={() => handleSave(LessonStatus.PUBLISHED)} className="bg-[#003882] text-white px-8 py-3 rounded-full text-[10px] font-black uppercase">Publish</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <SectionHeader title="Core Identity" />
                      <input className="w-full bg-white border-2 border-transparent focus:border-[#EF4E92] rounded-[32px] px-8 py-6 font-black text-xl outline-none shadow-sm" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Lesson Title..." />
                    </div>
                    <div className="space-y-4">
                      <SectionHeader title="Classification" />
                      <select className="w-full bg-white rounded-[32px] px-8 py-6 font-black text-sm uppercase tracking-widest shadow-sm outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                        <option>History</option><option>Gospels</option><option>Epistles</option><option>Prophets</option><option>Poetry</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-white rounded-[64px] p-8 md:p-12 border border-gray-50 shadow-sm">
                    <SectionHeader title="Lesson Body Pillars" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {['read', 'teach', 'engage'].map((pillar) => (
                        <div key={pillar} className="space-y-6">
                          <h4 className="font-black text-sm uppercase tracking-widest text-[#EF4E92] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#EF4E92]"></span>
                            {pillar}
                          </h4>
                          {(structure as any)[pillar].map((sub: LessonSubSection) => (
                            <SubSectionCard 
                              key={sub.id} 
                              sub={sub} 
                              onUpdate={(updates) => {
                                const newPillar = (structure as any)[pillar].map((s: any) => s.id === sub.id ? { ...s, ...updates } : s);
                                setStructure({ ...structure, [pillar]: newPillar });
                              }}
                              onDelete={() => {
                                const newPillar = (structure as any)[pillar].filter((s: any) => s.id !== sub.id);
                                setStructure({ ...structure, [pillar]: newPillar });
                              }}
                              placeholder="Describe content..." 
                            />
                          ))}
                          <button onClick={() => setStructure({ ...structure, [pillar]: [...(structure as any)[pillar], { id: Math.random().toString(36).substr(2, 9), title: 'New Sub', content: '' }] })} className="w-full border-2 border-dashed border-gray-100 py-4 rounded-[32px] text-[9px] font-black uppercase text-gray-300 hover:border-[#EF4E92] hover:text-[#EF4E92] transition-all">+ Add Sub</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Activities */}
                  <div className="space-y-8">
                    <div className="flex justify-between items-center">
                      <SectionHeader title="Hands-on Activities" />
                      <button onClick={() => setActivities([...activities, { title: '', instructions: '', supplies: [], duration_minutes: 15 }])} className="text-[#EF4E92] font-black uppercase text-[10px] tracking-widest">+ NEW ACTIVITY</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {activities.map((act, idx) => (
                        <div key={idx} className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-50 space-y-4">
                          <input className="w-full font-black text-lg outline-none" value={act.title} onChange={e => {
                            const n = [...activities]; n[idx].title = e.target.value; setActivities(n);
                          }} placeholder="Activity Name..." />
                          <textarea className="w-full text-sm font-medium text-gray-500 outline-none resize-none" rows={3} value={act.instructions} onChange={e => {
                            const n = [...activities]; n[idx].instructions = e.target.value; setActivities(n);
                          }} placeholder="Instructions..." />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* SQL FORGE VIEW */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-4xl font-black text-[#003882] tracking-tighter uppercase">SQL Forge</h2>
                <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-2">Running via exec_sql RPC</p>
              </div>
              <button onClick={handleRunSql} disabled={isExecuting} className="bg-[#EF4E92] text-white px-12 py-5 rounded-full font-black uppercase tracking-widest shadow-xl flex items-center gap-3 disabled:opacity-50">
                {isExecuting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Execute Statement'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-sm space-y-6">
                  <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Templates</h3>
                  <div className="space-y-2">
                    {sqlTemplates.map((t, idx) => (
                      <button key={idx} onClick={() => setSqlQuery(t.query)} className="w-full text-left p-4 rounded-2xl bg-gray-50 hover:bg-[#EF4E92] hover:text-white transition-all text-[10px] font-black uppercase truncate">{t.name}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-9 space-y-8">
                <div className="bg-[#1E1E1E] rounded-[48px] overflow-hidden shadow-2xl border border-gray-800">
                  <div className="px-10 py-5 bg-[#2D2D2D] border-b border-gray-800 flex items-center justify-between">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500/30"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500/30"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500/30"></div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Workspace</span>
                  </div>
                  <textarea className="w-full bg-transparent text-pink-300 p-10 font-mono text-lg outline-none resize-none leading-relaxed h-[300px]" spellCheck={false} value={sqlQuery} onChange={e => setSqlQuery(e.target.value)} />
                </div>

                <div className="bg-white rounded-[48px] border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
                  {sqlError ? (
                    <div className="p-12 text-red-500 space-y-4">
                      <p className="font-black text-xl uppercase">Query Error</p>
                      <pre className="bg-red-50 p-6 rounded-2xl font-mono text-sm whitespace-pre-wrap">{sqlError}</pre>
                    </div>
                  ) : sqlResults ? (
                    <div className="p-0">
                       <div className="px-10 py-6 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between font-black uppercase tracking-widest text-[10px] text-gray-400">
                         <span>Results • {sqlResults.length} Rows</span>
                       </div>
                       <div className="overflow-x-auto">
                         {sqlResults.length > 0 ? (
                            <table className="w-full text-left text-xs font-medium">
                              <thead>
                                <tr className="border-b border-gray-100">
                                  {Object.keys(sqlResults[0]).map(key => (
                                    <th key={key} className="px-10 py-6 font-black uppercase text-gray-400">{key}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {sqlResults.map((row, i) => (
                                  <tr key={i} className="hover:bg-gray-50/50">
                                    {Object.values(row).map((val: any, j) => (
                                      <td key={j} className="px-10 py-5 text-gray-600 truncate max-w-[200px]">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                         ) : <div className="py-20 text-center text-gray-300 font-black text-[10px] uppercase">No data</div>}
                       </div>
                    </div>
                  ) : <div className="h-[400px] flex items-center justify-center text-gray-200 font-black uppercase text-[10px]">Execute to see data</div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
