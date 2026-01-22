
import React, { useState, useEffect } from 'react';
import { db } from '../services/supabaseService';
import { Lesson, UserRole, Profile } from '../types';

interface TeacherDashboardProps {
  user: Profile;
  onLogout: () => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, onLogout }) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await db.lessons.list(UserRole.TEACHER);
        setLessons(data);
      } catch (e: any) {
        setError(e.message || "Failed to load lessons. Please try again later.");
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const filteredLessons = lessons.filter(l => {
    const matchesSearch = l.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          l.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = categoryFilter === 'All' || l.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const categories = ['All', ...Array.from(new Set(lessons.map(l => l.category)))];

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-black">Hello, {user.name} 👋</h1><p className="text-sm text-gray-400 font-medium">Ready for today's lesson?</p></div>
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Search lessons..." className="bg-gray-50 rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-pink-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <button onClick={onLogout} className="p-3 text-gray-400 hover:text-black">Logout</button>
        </div>
      </header>

      {error && (
        <div className="max-w-4xl mx-auto p-10 text-center">
          <div className="bg-red-50 p-10 rounded-[40px] border border-red-100">
            <h2 className="text-xl font-bold text-red-700 mb-2">Oops! Something went wrong</h2>
            <p className="text-red-500 mb-6">{error}</p>
            <button onClick={() => window.location.reload()} className="bg-red-500 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-red-200">Retry</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row gap-10">
        <aside className="w-full md:w-64 shrink-0 space-y-8">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Categories</h3>
          <div className="flex flex-wrap md:flex-col gap-2">
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-4 py-2 rounded-xl text-left text-sm font-semibold ${categoryFilter === cat ? 'bg-black text-white' : 'bg-gray-50'}`}>{cat}</button>
            ))}
          </div>
        </aside>

        <main className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="bg-gray-100 rounded-3xl h-64"></div>)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLessons.map(lesson => (
                <div key={lesson.id} onClick={() => window.location.hash = `#/lesson/${lesson.id}`} className="group bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden">
                  <h2 className="text-xl font-bold mb-2 group-hover:text-pink-500">{lesson.title}</h2>
                  <p className="text-sm text-gray-500 mb-6 line-clamp-2">{lesson.summary}</p>
                  <div className="text-xs font-bold text-gray-300 uppercase tracking-widest">Grade {lesson.grade_min}-{lesson.grade_max}</div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default TeacherDashboard;
