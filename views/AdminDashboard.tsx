import React, { useState, useEffect } from 'react';
import { db } from '../services/supabaseService.ts';
import { Lesson, LessonStatus, UserRole, Profile, LessonActivity, LessonVideo, Attachment } from '../types.ts';
import { generateLessonSummary, generateActivitiesDraft, generateDiscussionQuestions } from '../services/geminiService.ts';

interface AdminDashboardProps {
  user: Profile;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Lesson>>({
    title: '', summary: '', content: '', category: 'Story', series: '', grade_min: 1, grade_max: 5, tags: [], status: LessonStatus.DRAFT
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
      setError("Failed to load lessons. Please check your Supabase configuration.");
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
    setFormData({ title: '', summary: '', content: '', category: 'Story', series: '', grade_min: 1, grade_max: 5, tags: [], status: LessonStatus.DRAFT });
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
    if (!confirm("Are you sure you want to delete this lesson? This cannot be undone.")) return;
    
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!editingId || editingId === 'new') {
      alert("Please save the lesson as a draft before uploading files.");
      return;
    }
    
    setUploading(true);
    setError(null);
    try {
      const uploadRes = await db.storage.upload(file);
      await db.attachments.add({
        lesson_id: editingId,
        name: file.name,
        type: file.type.includes('pdf') ? 'pdf' : (file.type.includes('image') ? 'image' : 'doc'),
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

  const handleAiAction = async (action: () => Promise<any>) => {
    if (!formData.content) return alert("Add content for the AI to analyze!");
    setAiLoading(true);
    setError(null);
    try {
      await action();
    } catch (e: any) {
      setError(`AI Error: ${e.message}. Check your API_KEY and connection.`);
    } finally {
      setAiLoading(false);
    }
  };

  const updateActivity = (idx: number, updates: Partial<LessonActivity>) => {
    const next = [...activities];
    next[idx] = { ...next[idx], ...updates };
    setActivities(next);
  };

  const addVideo = () => setVideos([...videos, { url: '', title: '', provider: 'youtube' }]);
  const removeVideo = (idx: number) => setVideos(videos.filter((_, i) => i !== idx));
  const updateVideo = (idx: number, url: string) => {
    const next = [...videos];
    next[idx] = { ...next[idx], url };
    setVideos(next);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gray-900 text-white px-8 py-6 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="bg-pink-500 w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-pink-500/20">K</div>
          <div><h1 className="text-lg font-bold tracking-tight">KingdomKids Admin</h1><p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Management Portal</p></div>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-xs text-gray-400 font-medium hidden md:block">Signed in as {user.name}</span>
          <button onClick={onLogout} className="text-xs font-black uppercase tracking-widest text-pink-500 hover:text-pink-400 transition-colors">Sign Out</button>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-8 mt-4 rounded-r-xl flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            <p className="text-red-700 text-sm font-semibold">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition-colors">✕</button>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-2xl tracking-tighter">Lesson Directory</h2>
            <button onClick={handleNew} className="bg-black text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg shadow-gray-200">+ New Lesson</button>
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-250px)] pr-2 scrollbar-hide">
            {lessons.map(l => (
              <div 
                key={l.id} 
                onClick={() => handleEdit(l.id)} 
                className={`p-6 rounded-[32px] border transition-all cursor-pointer group ${editingId === l.id ? 'border-pink-500 bg-pink-50 ring-8 ring-pink-500/5' : 'border-gray-100 bg-white hover:border-gray-300'}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-sm line-clamp-1 group-hover:text-pink-600 transition-colors">{l.title}</h3>
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${l.status === LessonStatus.PUBLISHED ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>{l.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{l.category}</p>
                  <p className="text-[10px] text-gray-300 font-bold">Updated {new Date(l.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {lessons.length === 0 && <p className="text-center py-10 text-gray-400 text-sm italic">No lessons found.</p>}
          </div>
        </div>

        <div className="lg:col-span-8">
          {!editingId ? (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-gray-50 rounded-[48px] border-4 border-dashed border-gray-100 text-gray-300 p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              </div>
              <p className="font-black uppercase tracking-widest text-xs">Select or create a lesson to begin crafting content</p>
            </div>
          ) : (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-wrap items-center justify-between gap-4 sticky top-4 z-40 bg-white/90 backdrop-blur-2xl p-5 rounded-[32px] border border-gray-100 shadow-2xl shadow-gray-200">
                <div className="flex items-center gap-3">
                  <h2 className="font-black text-xl px-2">{editingId === 'new' ? 'New Masterpiece' : 'Refining Lesson'}</h2>
                  {loading && <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>}
                </div>
                <div className="flex gap-2">
                  {editingId !== 'new' && (
                    <button onClick={handleDelete} className="px-5 py-2 text-xs font-black uppercase text-red-500 hover:bg-red-50 rounded-2xl transition-all">Delete</button>
                  )}
                  <button onClick={() => setEditingId(null)} className="px-5 py-2 text-xs font-black uppercase text-gray-400 hover:text-black transition-all">Discard</button>
                  <button disabled={loading} onClick={() => handleSave(LessonStatus.DRAFT)} className="px-6 py-2.5 bg-gray-100 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all">Save Draft</button>
                  <button disabled={loading} onClick={() => handleSave(LessonStatus.PUBLISHED)} className="px-8 py-2.5 bg-pink-500 rounded-2xl text-xs font-black uppercase tracking-widest text-white hover:bg-pink-600 shadow-xl shadow-pink-500/20 transition-all">Publish Now</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button disabled={aiLoading} onClick={() => handleAiAction(async () => {
                  const summary = await generateLessonSummary(formData.content!) || '';
                  setFormData(prev => ({...prev, summary}));
                })} className="group flex flex-col items-center p-6 bg-indigo-50/50 border border-indigo-100 rounded-[32px] hover:bg-indigo-50 transition-all text-indigo-600 disabled:opacity-50">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">AI Assistant</span>
                  <span className="text-sm font-bold">✨ Smart Summary</span>
                </button>
                <button disabled={aiLoading} onClick={() => handleAiAction(async () => {
                  const questions = await generateDiscussionQuestions(formData.content!, `${formData.grade_min}-${formData.grade_max}`);
                  setFormData(prev => ({...prev, content: `${prev.content}\n\n## Discussion Questions\n${questions}`}));
                })} className="group flex flex-col items-center p-6 bg-purple-50/50 border border-purple-100 rounded-[32px] hover:bg-purple-50 transition-all text-purple-600 disabled:opacity-50">
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">AI Assistant</span>
                  <span className="text-sm font-bold">💬 Deep Questions</span>
                </button>
                <button disabled={aiLoading} onClick={() => handleAiAction(async () => {
                  const draftActivities = await generateActivitiesDraft(formData.content!, `${formData.grade_min}-${formData.grade_max}`);
                  setActivities(prev => [...prev, ...draftActivities]);
                })} className="group flex flex-col items-center p-6 bg-pink-50/50 border border-pink-100 rounded-[32px] hover:bg-pink-50 transition-all text-pink-600 disabled:opacity-50">
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">AI Assistant</span>
                  <span className="text-sm font-bold">🎨 Creative Ideas</span>
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Lesson Identity</label>
                  <input placeholder="Ex: The Miracles of Jesus" className="w-full bg-gray-50 border-none rounded-3xl px-8 py-5 font-bold text-2xl focus:ring-4 focus:ring-pink-500/10 transition-all" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">The Lesson Body (Markdown)</label>
                  <textarea placeholder="Start typing the story or instructions..." rows={15} className="w-full bg-gray-50 border-none rounded-[32px] px-8 py-6 font-mono text-sm leading-relaxed focus:ring-4 focus:ring-pink-500/10 transition-all" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
                </div>
              </div>

              <div className="space-y-12">
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-black text-2xl tracking-tight">Interactive Activities</h3>
                    <button onClick={() => setActivities([...activities, { title: '', instructions: '', supplies: [], duration_minutes: 15 }])} className="bg-gray-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">+ Add New</button>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    {activities.map((act, idx) => (
                      <div key={idx} className="bg-white border-2 border-gray-50 rounded-[40px] p-8 shadow-sm space-y-6 relative group overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => setActivities(activities.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 font-bold text-xs uppercase">Delete</button>
                        </div>
                        <input placeholder="Activity Name" className="text-xl font-black w-full bg-transparent border-b-2 border-gray-100 focus:border-pink-500 outline-none pb-2 transition-colors" value={act.title} onChange={e => updateActivity(idx, { title: e.target.value })} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <textarea placeholder="Step-by-step instructions..." className="w-full bg-gray-50 rounded-3xl p-6 text-sm min-h-[120px]" value={act.instructions} onChange={e => updateActivity(idx, { instructions: e.target.value })} />
                          <div className="space-y-4">
                             <input placeholder="Supplies (comma separated)" className="w-full bg-gray-50 rounded-2xl px-6 py-4 text-xs font-bold" value={act.supplies?.join(', ')} onChange={e => updateActivity(idx, { supplies: e.target.value.split(',').map(s => s.trim()) })} />
                             <div className="flex items-center gap-4">
                               <span className="text-[10px] font-black uppercase text-gray-400">Minutes:</span>
                               <input type="number" className="bg-gray-50 rounded-2xl px-4 py-2 text-xs font-bold w-20" value={act.duration_minutes} onChange={e => updateActivity(idx, { duration_minutes: parseInt(e.target.value) })} />
                             </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {activities.length === 0 && <p className="text-center py-10 bg-gray-50 rounded-[32px] text-gray-400 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-gray-100">No activities added yet</p>}
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <section>
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="font-black text-2xl tracking-tight">Multimedia</h3>
                      <button onClick={addVideo} className="text-pink-500 text-[10px] font-black uppercase tracking-widest">+ Add URL</button>
                    </div>
                    <div className="space-y-4">
                      {videos.map((vid, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-[24px] p-5 flex items-center gap-4 border border-transparent hover:border-pink-200 transition-all">
                          <div className="bg-gray-900 w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                          </div>
                          <input placeholder="YouTube or Vimeo URL" className="flex-1 bg-transparent border-none text-xs font-bold outline-none" value={vid.url} onChange={e => updateVideo(idx, e.target.value)} />
                          <button onClick={() => removeVideo(idx)} className="text-gray-300 hover:text-red-500">✕</button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="font-black text-2xl tracking-tight">Handouts</h3>
                      <label className={`cursor-pointer bg-pink-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-pink-600 transition-all shadow-lg shadow-pink-100 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        {uploading ? 'Uploading...' : '+ Upload File'}
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {attachments.map(att => (
                        <div key={att.id} className="bg-gray-900 text-white rounded-[24px] p-5 flex items-center justify-between group transition-all">
                          <div className="flex items-center gap-4 overflow-hidden">
                            <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center shrink-0">
                               <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            </div>
                            <div className="flex flex-col truncate">
                              <span className="text-[10px] font-black uppercase tracking-widest truncate">{att.name}</span>
                              <span className="text-[8px] text-gray-500 font-bold">{(att.size_bytes / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>
                          <button onClick={() => db.attachments.remove(att.id, att.storage_path).then(() => setAttachments(attachments.filter(a => a.id !== att.id)))} className="text-gray-600 hover:text-red-500 p-2">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      ))}
                      {attachments.length === 0 && <p className="text-center py-6 text-gray-300 text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-gray-50 rounded-[24px]">No downloads</p>}
                    </div>
                  </section>
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