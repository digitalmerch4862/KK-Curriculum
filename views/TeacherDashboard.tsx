
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

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await db.lessons.list(UserRole.TEACHER);
        setLessons(data);
      } catch (e) {
        console.error("Failed to fetch lessons", e);
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
        <div>
          <h1 className="text-2xl font-black">Hello, {user.name} 👋</h1>
          <p className="text-sm text-gray-400 font-medium">Ready for today's lesson?</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <input 
              type="text" 
              placeholder="Search lessons..."
              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-pink-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={onLogout} className="p-3 text-gray-400 hover:text-black transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row gap-10">
        <aside className="w-full md:w-64 shrink-0 space-y-8">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Categories</h3>
            <div className="flex flex-wrap md:flex-col gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-4 py-2 rounded-xl text-left text-sm font-semibold transition-all ${
                    categoryFilter === cat ? 'bg-black text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
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
                <div 
                  key={lesson.id}
                  onClick={() => window.location.hash = `#/lesson/${lesson.id}`}
                  className="group bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-pink-50 rounded-bl-full -mr-12 -mt-12 transition-transform group-hover:scale-150"></div>
                  <div className="relative z-10">
                    <span className="inline-block bg-gray-50 text-gray-500 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md mb-3">
                      {lesson.category}
                    </span>
                    <h2 className="text-xl font-bold mb-2 group-hover:text-pink-500 transition-colors line-clamp-2">
                      {lesson.title}
                    </h2>
                    <p className="text-sm text-gray-500 mb-6 line-clamp-2 leading-relaxed">
                      {lesson.summary}
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="text-xs font-bold text-gray-300">
                        GRADE {lesson.grade_min}-{lesson.grade_max}
                      </div>
                      <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white transform group-hover:translate-x-1 transition-transform">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredLessons.length === 0 && (
                <div className="col-span-full py-20 text-center">
                  <p className="text-gray-400 font-medium">No lessons found matching your filters.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default TeacherDashboard;
