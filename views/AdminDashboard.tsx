import React, { useState, useEffect } from 'react';
import { db } from '../services/supabaseService.ts';
import { Lesson, LessonStatus, UserRole, Profile, LessonActivity, LessonVideo, Attachment } from '../types.ts';
import { 
  generateLessonSummary, 
  generateActivitiesDraft, 
  generateDiscussionQuestions, 
  generateStructuredLesson 
} from '../services/geminiService.ts';

interface AdminDashboardProps {
  user: Profile;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Lesson>>({
    title: '', summary: '', content: '', category: 'Story', series: '', grade_min: 5, grade_max: 10, tags: [], status: LessonStatus.DRAFT
  });
  const [activities, setActivities] = useState<Partial<LessonActivity>[]>([]);
  const [videos, setVideos] = useState<Partial<LessonVideo>[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    try {
      const data = await db.lessons.list(UserRole.ADMIN);
      setLessons(data);
      setError(null);
    } catch (e: any) {
      setError("Failed to load lessons. Check database connection.");
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
      }
    } catch (e: any) {
      setError(`Error loading lesson: ${e.message}`);
    }
  };

  const handleNew = () => {
    setEditingId('new');
    setFormData({ title: '', summary: '', content: '', category: 'Bible Stories', series: '', grade_min: 5, grade_max: 10, tags: [], status: LessonStatus.DRAFT });
    setActivities([]);
    setVideos([]);
    setAttachments([]);
    setError(null);
  };

  const handleSave = async (status: LessonStatus) => {
    if (!formData.title) return alert("Title is required");
    setLoading(true);
    setError(null);
    try {
      await db.lessons.upsert({ ...formData, status, created_by: user.id }, activities, videos);
      setEditingId(null);
      fetchLessons();
    } catch (e: any) {
      setError(`Save failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId || editingId === 'new') return;
    if (!confirm("Are you sure?")) return;
    setLoading(true);
    try {
      await db.lessons.delete(editingId);
      setEditingId(null);
      fetchLessons();
    } catch (e: any) {
      setError(`Delete failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAiAction = async (action: () => Promise<any>) => {
    setAiLoading(true);
    setError(null);
    try {
      await action();
    } catch (e: any) {
      setError(`AI Assistant Error: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleKingdomBuilder = async () => {
    if (!formData.title) return alert("Please enter a lesson title or topic first!");
    await handleAiAction(async () => {
      const fullContent = await generateStructuredLesson(formData.title!);
      setFormData(prev => ({ ...prev, content: fullContent }));
    });
  };

  const updateActivity = (idx: number, updates: Partial<LessonActivity>) => {
    const next = [...activities];
    next[idx] = { ...next[idx], ...updates };
    setActivities(next);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingId || editingId === 'new') return alert("Save as draft first.");
    setUploading(true);
    try {
      const uploadRes = await db.storage.upload(file);
      await db.attachments.add({
        lesson_id: editingId,
        name: file.name,
        type: 'pdf',
        storage_path: uploadRes.path,
        size_bytes: file.size,
        sort_order: attachments.length
      });
      const full = await db.lessons.get(editingId);
      if (full) setAttachments(full.attachments || []);
    } catch (e: any) {
      setError(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gray-900 text-white px-8 py-6 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="bg-pink-500 w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl">K</div>
          <h1 className="text-lg font-bold">KingdomKids Admin</h1>
        </div>
        <button onClick={onLogout} className="text-xs font-black uppercase text-pink-500">Sign Out</button>
      </header>

      {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-8 mt-4 rounded-r-xl">{error}</div>}

      <div className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-2xl">Lessons</h2>
            <button onClick={handleNew} className="bg-black text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase">+ New</button>
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-250px)] pr-2">
            {lessons.map(l => (
              <div 
                key={l.id} 
                onClick={() => handleEdit(l.id)} 
                className={`p-6 rounded-[32px] border transition-all cursor-pointer ${editingId === l.id ? 'border-pink-500 bg-pink-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
              >
                <h3 className="font-bold text-sm mb-2">{l.title}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-gray-400">{l.category}</span>
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${l.status === LessonStatus.PUBLISHED ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>{l.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8">
          {!editingId ? (
            <div className="h-[600px] flex flex-col items-center justify-center bg-gray-50 rounded-[48px] border-4 border-dashed border-gray-100 text-gray-300">
              <p className="font-black uppercase tracking-widest text-xs">Select a lesson to begin</p>
            </div>
          ) : (
            <div className="space-y-12 animate-in fade-in duration-500">
              <div className="flex flex-wrap items-center justify-between gap-4 sticky top-4 z-40 bg-white/90 backdrop-blur-xl p-5 rounded-[32px] border border-gray-100 shadow-xl">
                <h2 className="font-black text-xl px-2">{editingId === 'new' ? 'New Masterpiece' : 'Refining Lesson'}</h2>
                <div className="flex gap-2">
                  <button onClick={() => setEditingId(null)} className="px-5 py-2 text-xs font-black uppercase text-gray-400">Discard</button>
                  <button disabled={loading} onClick={() => handleSave(LessonStatus.DRAFT)} className="px-6 py-2.5 bg-gray-100 rounded-2xl text-xs font-black uppercase">Save Draft</button>
                  <button disabled={loading} onClick={() => handleSave(LessonStatus.PUBLISHED)} className="px-8 py-2.5 bg-pink-500 rounded-2xl text-xs font-black uppercase text-white shadow-lg shadow-pink-200">Publish</button>
                </div>
              </div>

              {/* AI TOOLS SECTION */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Kingdom Assistant</label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <button disabled={aiLoading} onClick={handleKingdomBuilder} className="magic-gradient text-white p-6 rounded-[32px] hover:scale-[1.02] transition-all disabled:opacity-50">
                    <span className="text-[10px] font-black uppercase block mb-1">Kingdom Builder</span>
                    <span className="text-sm font-bold block">✨ Create Full Lesson</span>
                  </button>
                  <button disabled={aiLoading} onClick={() => handleAiAction(async () => {
                    const summary = await generateLessonSummary(formData.content!);
                    setFormData(prev => ({...prev, summary}));
                  })} className="bg-indigo-50 border border-indigo-100 text-indigo-600 p-6 rounded-[32px] hover:bg-indigo-100 transition-all disabled:opacity-50">
                    <span className="text-[10px] font-black uppercase block mb-1">Preview</span>
                    <span className="text-sm font-bold block">Smart Summary</span>
                  </button>
                  <button disabled={aiLoading} onClick={() => handleAiAction(async () => {
                    const q = await generateDiscussionQuestions(formData.content!);
                    setFormData(prev => ({...prev, content: `${prev.content}\n\n# Discussion\n${q}`}));
                  })} className="bg-purple-50 border border-purple-100 text-purple-600 p-6 rounded-[32px] hover:bg-purple-100 transition-all disabled:opacity-50">
                    <span className="text-[10px] font-black uppercase block mb-1">Logic</span>
                    <span className="text-sm font-bold block">Deep Questions</span>
                  </button>
                  <button disabled={aiLoading} onClick={() => handleAiAction(async () => {
                    const draft = await generateActivitiesDraft(formData.content!);
                    setActivities(prev => [...prev, ...draft]);
                  })} className="bg-pink-50 border border-pink-100 text-pink-600 p-6 rounded-[32px] hover:bg-pink-100 transition-all disabled:opacity-50">
                    <span className="text-[10px] font-black uppercase block mb-1">Play</span>
                    <span className="text-sm font-bold block">Creative Ideas</span>
                  </button>
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Lesson Title / Topic</label>
                  <input placeholder="Ex: Jesus Calms the Storm" className="w-full bg-gray-50 border-none rounded-3xl px-8 py-5 font-bold text-2xl focus:ring-4 focus:ring-pink-500/10 transition-all" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Series Title</label>
                    <input placeholder="Ex: Life of Christ" className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold" value={formData.series} onChange={e => setFormData({...formData, series: e.target.value})} />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Category</label>
                    <select className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold appearance-none cursor-pointer" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                      <option>Parables</option><option>Miracles</option><option>Bible Stories</option><option>History</option><option>Songs</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Lesson Content (Markdown)</label>
                  <textarea placeholder="Write or generate your lesson here..." rows={20} className="w-full bg-gray-50 border-none rounded-[32px] px-8 py-6 font-mono text-sm leading-relaxed focus:ring-4 focus:ring-pink-500/10 transition-all" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
                </div>
              </div>

              <section className="space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-2xl">Structured Activities</h3>
                  <button onClick={() => setActivities([...activities, { title: '', instructions: '', supplies: [], duration_minutes: 15 }])} className="text-xs font-black uppercase text-pink-500">+ Add</button>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {activities.map((act, idx) => (
                    <div key={idx} className="bg-white border-2 border-gray-50 rounded-[40px] p-8 shadow-sm space-y-4">
                      <input placeholder="Activity Name" className="text-xl font-black w-full bg-transparent border-b-2 border-gray-100 focus:border-pink-500 outline-none pb-2 transition-colors" value={act.title} onChange={e => updateActivity(idx, { title: e.target.value })} />
                      <textarea placeholder="Instructions..." className="w-full bg-gray-50 rounded-3xl p-6 text-sm min-h-[100px]" value={act.instructions} onChange={e => updateActivity(idx, { instructions: e.target.value })} />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;