
import React, { useState, useEffect } from 'react';
import { db } from '../services/supabaseService';
import { Lesson, LessonStatus, UserRole, Profile, LessonActivity, LessonVideo, Attachment } from '../types';
import { generateLessonSummary, generateActivitiesDraft, generateDiscussionQuestions } from '../services/geminiService';

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

  const resetForm = () => {
    setEditingId(null);
    setFormData({ title: '', summary: '', content: '', category: 'Story', series: '', grade_min: 1, grade_max: 5, tags: [], status: LessonStatus.DRAFT });
    setActivities([]);
    setVideos([]);
    setAttachments([]);
  };

  const handleEdit = async (id: string) => {
    const full = await db.lessons.get(id);
    if (full) {
      setEditingId(id);
      setFormData(full);
      setActivities(full.activities || []);
      setVideos(full.videos || []);
      setAttachments(full.attachments || []);
    }
  };

  const handleSave = async (status: LessonStatus) => {
    if (!formData.title) return alert("Title is required");
    setLoading(true);
    try {
      await db.lessons.upsert({ ...formData, status, created_by: user.id }, activities, videos);
      resetForm();
      fetchLessons();
    } catch (e) {
      alert("Error saving lesson");
      console.error(e);
    }
    setLoading(false);
  };

  const addActivity = () => {
    setActivities([...activities, { title: '', supplies: [], instructions: '', duration_minutes: 15 }]);
  };

  const addVideo = () => {
    setVideos([...videos, { title: '', url: '', provider: 'youtube' }]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingId || editingId === 'new') {
      alert("Please save the lesson as a draft before uploading files.");
      return;
    }
    
    setUploading(true);
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
      // Refresh attachments
      const full = await db.lessons.get(editingId);
      if (full) setAttachments(full.attachments || []);
    } catch (e) {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = async (id: string, path: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await db.attachments.remove(id, path);
      setAttachments(attachments.filter(a => a.id !== id));
    } catch (e) {
      alert("Failed to remove attachment");
    }
  };

  const handleGenerateSummary = async () => {
    if (!formData.content) return alert("Add some content first!");
    setAiLoading(true);
    const res = await generateLessonSummary(formData.content);
    setFormData(prev => ({ ...prev, summary: res || '' }));
    setAiLoading(false);
  };

  const handleGenerateQuestions = async () => {
    if (!formData.content) return alert("Add some content first!");
    setAiLoading(true);
    const range = `${formData.grade_min}-${formData.grade_max}`;
    const res = await generateDiscussionQuestions(formData.content, range);
    if (res) {
      setFormData(prev => ({ ...prev, content: `${prev.content}\n\n## Discussion Questions\n${res}` }));
    }
    setAiLoading(false);
  };

  const handleGenerateActivities = async () => {
    if (!formData.content) return alert("Add some content first!");
    setAiLoading(true);
    const range = `${formData.grade_min}-${formData.grade_max}`;
    const acts = await generateActivitiesDraft(formData.content, range);
    if (acts && acts.length > 0) {
      setActivities(prev => [...prev, ...acts]);
    }
    setAiLoading(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gray-900 text-white px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-pink-500 w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-pink-500/20">K</div>
          <div>
            <h1 className="text-lg font-bold">KingdomKids Admin</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Signed in as {user.name}</p>
          </div>
        </div>
        <button onClick={onLogout} className="text-sm font-bold text-gray-400 hover:text-white transition-colors">Sign Out</button>
      </header>

      <div className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left List */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-2xl">Lessons</h2>
            <button 
              onClick={() => { setEditingId('new'); setFormData({ title: '', summary: '', content: '', category: 'Story', series: '', grade_min: 1, grade_max: 5, tags: [], status: LessonStatus.DRAFT }); setActivities([]); setVideos([]); setAttachments([]); }}
              className="bg-black text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
              New
            </button>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-2 scrollbar-hide">
            {lessons.map(l => (
              <div 
                key={l.id} 
                onClick={() => handleEdit(l.id)}
                className={`p-5 rounded-3xl border transition-all cursor-pointer ${editingId === l.id ? 'border-pink-500 bg-pink-50 ring-4 ring-pink-500/5' : 'border-gray-100 hover:border-gray-300 bg-white'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-sm truncate max-w-[70%]">{l.title}</h3>
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${l.status === LessonStatus.PUBLISHED ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
                    {l.status}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{l.category} • Grades {l.grade_min}-{l.grade_max}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Editor */}
        <div className="lg:col-span-8">
          {!editingId ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-gray-50 rounded-[40px] border-4 border-dashed border-gray-100 text-gray-300 p-10 text-center">
              <svg className="w-20 h-20 mb-4 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              <p className="font-bold uppercase tracking-widest text-sm">Select a lesson to start editing</p>
            </div>
          ) : (
            <div className="space-y-10 pb-20">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-4 sticky top-4 z-40 bg-white/80 backdrop-blur-xl p-4 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100">
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-xl px-2">{editingId === 'new' ? 'Drafting' : 'Editing'}</h2>
                  {aiLoading && <div className="text-pink-500 text-xs font-bold animate-pulse">✨ AI processing...</div>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingId(null)} className="px-5 py-2 text-sm font-bold text-gray-400 hover:text-black transition-colors">Discard</button>
                  <button disabled={loading} onClick={() => handleSave(LessonStatus.DRAFT)} className="px-6 py-2 bg-gray-100 rounded-2xl text-sm font-bold hover:bg-gray-200 transition-all">Save Draft</button>
                  <button disabled={loading} onClick={() => handleSave(LessonStatus.PUBLISHED)} className="px-8 py-2 bg-pink-500 rounded-2xl text-sm font-bold text-white hover:bg-pink-600 shadow-xl shadow-pink-500/20 transition-all">Publish</button>
                </div>
              </div>

              {/* AI Powerups */}
              <div className="grid grid-cols-3 gap-3">
                <button onClick={handleGenerateSummary} className="flex flex-col items-center gap-2 p-4 bg-indigo-50 border border-indigo-100 rounded-3xl hover:bg-indigo-100 transition-all text-indigo-600">
                  <span className="text-xs font-black uppercase tracking-widest">✨ Summary</span>
                </button>
                <button onClick={handleGenerateQuestions} className="flex flex-col items-center gap-2 p-4 bg-purple-50 border border-purple-100 rounded-3xl hover:bg-purple-100 transition-all text-purple-600">
                  <span className="text-xs font-black uppercase tracking-widest">✨ Questions</span>
                </button>
                <button onClick={handleGenerateActivities} className="flex flex-col items-center gap-2 p-4 bg-pink-50 border border-pink-100 rounded-3xl hover:bg-pink-100 transition-all text-pink-600">
                  <span className="text-xs font-black uppercase tracking-widest">✨ Activities</span>
                </button>
              </div>

              {/* Main Fields */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Lesson Title</label>
                    <input className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-xl focus:ring-4 focus:ring-pink-500/10 transition-all" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Summary</label>
                    <textarea rows={3} className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm leading-relaxed focus:ring-4 focus:ring-pink-500/10 transition-all" value={formData.summary} onChange={e => setFormData({...formData, summary: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Category</label>
                    <select className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 text-sm font-bold" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                      <option>Parables</option><option>Miracles</option><option>Bible Stories</option><option>History</option><option>Songs</option>
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Grades Min</label>
                    <input type="number" className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 text-sm font-bold" value={formData.grade_min} onChange={e => setFormData({...formData, grade_min: parseInt(e.target.value)})} />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Grades Max</label>
                    <input type="number" className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 text-sm font-bold" value={formData.grade_max} onChange={e => setFormData({...formData, grade_max: parseInt(e.target.value)})} />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Main Content (Markdown)</label>
                  <textarea rows={12} className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-mono text-sm leading-loose focus:ring-4 focus:ring-pink-500/10 transition-all" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
                </div>
              </div>

              {/* Repeatable Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Activities Section */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-xl">Activities</h3>
                    <button onClick={addActivity} className="text-pink-500 text-xs font-black uppercase">+ New</button>
                  </div>
                  <div className="space-y-4">
                    {activities.map((act, idx) => (
                      <div key={idx} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm space-y-4">
                        <input placeholder="Activity Title" className="font-bold w-full border-b border-gray-100 pb-2 focus:border-pink-500 outline-none text-sm" value={act.title} onChange={e => {
                          const updated = [...activities]; updated[idx].title = e.target.value; setActivities(updated);
                        }} />
                        <textarea placeholder="Instructions" className="w-full bg-gray-50 rounded-xl p-3 text-xs min-h-[80px]" value={act.instructions} onChange={e => {
                          const updated = [...activities]; updated[idx].instructions = e.target.value; setActivities(updated);
                        }} />
                        <button onClick={() => setActivities(activities.filter((_, i) => i !== idx))} className="text-[10px] text-red-400 font-bold uppercase">Delete Activity</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Videos & Attachments Section */}
                <div className="space-y-10">
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-black text-xl">Videos</h3>
                      <button onClick={addVideo} className="text-pink-500 text-xs font-black uppercase">+ Add URL</button>
                    </div>
                    <div className="space-y-3">
                      {videos.map((vid, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-2xl p-4 flex gap-3">
                          <input placeholder="Video URL" className="flex-1 bg-transparent border-none text-xs outline-none" value={vid.url} onChange={e => {
                            const updated = [...videos]; updated[idx].url = e.target.value; setVideos(updated);
                          }} />
                          <button onClick={() => setVideos(videos.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-black text-xl">Files</h3>
                      <label className={`cursor-pointer text-pink-500 text-xs font-black uppercase ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        + Upload
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                      </label>
                    </div>
                    {uploading && <div className="text-[10px] text-pink-500 font-bold animate-pulse mb-4">Uploading to Supabase...</div>}
                    <div className="grid grid-cols-1 gap-2">
                      {attachments.map(att => (
                        <div key={att.id} className="bg-gray-900 text-white rounded-2xl p-4 flex items-center justify-between group">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center shrink-0">
                               <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            </div>
                            <span className="text-[10px] font-bold truncate">{att.name}</span>
                          </div>
                          <button onClick={() => removeAttachment(att.id, att.storage_path)} className="text-gray-600 hover:text-red-500">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
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
