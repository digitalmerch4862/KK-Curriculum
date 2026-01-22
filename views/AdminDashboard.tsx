
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseMock';
import { Lesson, LessonStatus, UserRole, Profile, LessonActivity } from '../types';
import { generateLessonSummary, generateActivitiesDraft } from '../services/geminiService';

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
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    const data = await supabase.lessons.list(UserRole.ADMIN);
    setLessons(data);
  };

  const handleEdit = async (id: string) => {
    const full = await supabase.lessons.get(id);
    if (full) {
      setEditingId(id);
      setFormData(full);
      setActivities(full.activities || []);
    }
  };

  const handleSave = async (status: LessonStatus) => {
    setLoading(true);
    await supabase.lessons.upsert({ ...formData, status }, activities);
    setEditingId(null);
    setFormData({ title: '', summary: '', content: '', category: 'Story', series: '', grade_min: 1, grade_max: 5, tags: [], status: LessonStatus.DRAFT });
    setActivities([]);
    fetchLessons();
    setLoading(false);
  };

  const addActivity = () => {
    setActivities([...activities, { title: '', supplies: [], instructions: '', duration_minutes: 15 }]);
  };

  const updateActivity = (idx: number, field: keyof LessonActivity, val: any) => {
    const updated = [...activities];
    updated[idx] = { ...updated[idx], [field]: val };
    setActivities(updated);
  };

  // AI Helpers
  const handleGenerateSummary = async () => {
    if (!formData.content) return alert("Add some content first!");
    setAiLoading(true);
    const summary = await generateLessonSummary(formData.content);
    setFormData(prev => ({ ...prev, summary: summary || '' }));
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
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="bg-pink-500 w-8 h-8 rounded flex items-center justify-center">K</span>
            Admin Studio
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Management Console</p>
        </div>
        <div className="flex gap-4">
          <button onClick={onLogout} className="text-sm font-bold opacity-60 hover:opacity-100 transition-opacity">Sign Out</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Lesson List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-black text-2xl">Lessons</h2>
            <button 
              onClick={() => { setEditingId('new'); setFormData({ title: '', summary: '', content: '', category: 'Story', series: '', grade_min: 1, grade_max: 5, tags: [], status: LessonStatus.DRAFT }); setActivities([]); }}
              className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
          
          <div className="space-y-3">
            {lessons.map(l => (
              <div 
                key={l.id} 
                onClick={() => handleEdit(l.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${editingId === l.id ? 'border-pink-500 bg-pink-50' : 'border-gray-100 hover:border-gray-300 bg-white'}`}
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-sm truncate pr-2">{l.title}</h3>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${l.status === LessonStatus.PUBLISHED ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                    {l.status}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 font-medium mt-1">{l.category} • Grade {l.grade_min}-{l.grade_max}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Editor Area */}
        <div className="lg:col-span-8 bg-gray-50 rounded-3xl p-8 border border-gray-100">
          {!editingId ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-40">
              <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              <p className="font-bold uppercase tracking-widest text-xs">Select a lesson or create one</p>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-2xl">{editingId === 'new' ? 'New Lesson' : 'Edit Lesson'}</h2>
                <div className="flex gap-2">
                  <button 
                    disabled={loading}
                    onClick={() => handleSave(LessonStatus.DRAFT)}
                    className="px-6 py-2 bg-white border-2 border-gray-900 rounded-xl text-sm font-bold hover:bg-gray-900 hover:text-white transition-all disabled:opacity-50"
                  >
                    Save Draft
                  </button>
                  <button 
                    disabled={loading}
                    onClick={() => handleSave(LessonStatus.PUBLISHED)}
                    className="px-6 py-2 bg-pink-500 rounded-xl text-sm font-bold text-white hover:bg-pink-600 shadow-lg shadow-pink-100 transition-all disabled:opacity-50"
                  >
                    Publish
                  </button>
                </div>
              </div>

              {/* AI Helper Bar */}
              <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest pl-2">AI Tools</span>
                <button 
                  onClick={handleGenerateSummary}
                  disabled={aiLoading}
                  className="px-3 py-1.5 bg-white rounded-lg text-xs font-bold text-indigo-600 shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                >
                  {aiLoading ? 'Thinking...' : '✨ Magic Summary'}
                </button>
                <button 
                  onClick={handleGenerateActivities}
                  disabled={aiLoading}
                  className="px-3 py-1.5 bg-white rounded-lg text-xs font-bold text-indigo-600 shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                >
                  {aiLoading ? 'Thinking...' : '✨ Suggest Activities'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Title</label>
                  <input 
                    className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-pink-500 transition-all"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Series</label>
                  <input 
                    className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-pink-500 transition-all"
                    value={formData.series}
                    onChange={e => setFormData({...formData, series: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Summary</label>
                  <textarea 
                    rows={2}
                    className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-pink-500 transition-all"
                    value={formData.summary}
                    onChange={e => setFormData({...formData, summary: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Lesson Content (Markdown)</label>
                  <textarea 
                    rows={10}
                    className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 font-mono text-sm focus:ring-2 focus:ring-pink-500 transition-all"
                    value={formData.content}
                    onChange={e => setFormData({...formData, content: e.target.value})}
                  />
                </div>
              </div>

              {/* Activities Management */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">Activities</h3>
                  <button onClick={addActivity} className="text-pink-500 text-sm font-bold">+ Add Activity</button>
                </div>
                <div className="space-y-6">
                  {activities.map((act, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4">
                      <div className="flex justify-between items-start">
                        <input 
                          placeholder="Activity Title"
                          className="font-bold text-lg bg-transparent border-b border-gray-100 focus:border-pink-500 outline-none w-full mr-4"
                          value={act.title}
                          onChange={e => updateActivity(idx, 'title', e.target.value)}
                        />
                        <button 
                          onClick={() => setActivities(activities.filter((_, i) => i !== idx))}
                          className="text-gray-300 hover:text-red-500"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Duration (Min)</label>
                          <input 
                            type="number"
                            className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm"
                            value={act.duration_minutes}
                            onChange={e => updateActivity(idx, 'duration_minutes', parseInt(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Supplies (Comma separated)</label>
                          <input 
                            className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm"
                            value={act.supplies?.join(', ')}
                            onChange={e => updateActivity(idx, 'supplies', e.target.value.split(',').map(s => s.trim()))}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Instructions</label>
                        <textarea 
                          className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm"
                          rows={3}
                          value={act.instructions}
                          onChange={e => updateActivity(idx, 'instructions', e.target.value)}
                        />
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
