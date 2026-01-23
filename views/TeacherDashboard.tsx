
import React, { useState, useEffect } from 'react';
import { db } from '../services/supabaseService.ts';
import { Lesson, UserRole, Profile } from '../types.ts';

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
        setError(e.message || "Failed to load lessons.");
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const filteredLessons = lessons.filter(l => {
    const matchesSearch = l.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'All' || l.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const categories = ['All', ...Array.from(new Set(lessons.map(l => l.category)))];

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900">Hello Teacher 👋</h1>
          <p className="text-xs md:text-sm text-gray-400 font-medium">Ready for today's mission?</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-full bg-gray-50 rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-[#EF4E92] outline-none transition-all" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <button onClick={onLogout} className="text-[#EF4E92] hover:text-[#EF4E92]/80 font-black text-xs uppercase tracking-widest transition-colors">Logout</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8 md:gap-12">
        <aside className="w-full lg:w-64 shrink-0">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6 hidden lg:block">FILTER BY CATEGORY</h3>
          <div className="flex overflow-x-auto lg:flex-col gap-2 pb-4 lg:pb-0 scrollbar-hide">
            {categories.map(cat => (
              <button 
                key={cat} 
                onClick={() => setCategoryFilter(cat)} 
                className={`px-6 py-2.5 rounded-2xl text-left text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${categoryFilter === cat ? 'bg-[#EF4E92] text-white shadow-lg shadow-[#EF4E92]/20' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="bg-gray-50 rounded-[40px] h-64 border border-gray-100"></div>)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
              {filteredLessons.map(lesson => (
                <div 
                  key={lesson.id} 
                  onClick={() => window.location.hash = `#/lesson/${lesson.id}`} 
                  className="group bg-white border border-gray-50 rounded-[40px] p-8 shadow-sm hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer flex flex-col min-h-[280px]"
                >
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <span className="bg-pink-50 text-[#EF4E92] px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">{lesson.category}</span>
                    </div>
                    <h2 className="text-xl font-black mb-3 text-gray-900 group-hover:text-[#EF4E92] transition-colors leading-tight">{lesson.title}</h2>
                    <p className="text-sm text-gray-400 font-medium line-clamp-3 mb-6 leading-relaxed">{lesson.summary}</p>
                  </div>
                  <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Grades {lesson.grade_min}-{lesson.grade_max}</span>
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-[#EF4E92] group-hover:text-white transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                </div>
              ))}
              {filteredLessons.length === 0 && (
                <div className="col-span-full py-20 text-center text-gray-300 font-medium">No lessons found match your filter.</div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default TeacherDashboard;
