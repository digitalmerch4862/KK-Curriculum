import React, { useState, useEffect } from 'react';
import { UserRole, AuthUser, Profile } from './types.ts';
import Login from './views/Login.tsx';
import TeacherDashboard from './views/TeacherDashboard.tsx';
import AdminDashboard from './views/AdminDashboard.tsx';
import LessonDetail from './views/LessonDetail.tsx';

/**
 * Core Application Component.
 * Handles authentication routing, global loading states, and path resolution.
 */
const App: React.FC = () => {
  const [user, setUser] = useState<AuthUser>(null);
  const [currentPath, setCurrentPath] = useState<string>(window.location.hash || '#/');
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('kingdomkids_session');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.error("Session restoration failed:", e);
      setHasError(true);
    } finally {
      setLoading(false);
    }

    const handleHashChange = () => {
      setCurrentPath(window.location.hash || '#/');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLogin = (profile: Profile) => {
    setUser(profile);
    localStorage.setItem('kingdomkids_session', JSON.stringify(profile));
    window.location.hash = profile.role === UserRole.ADMIN ? '#/admin' : '#/teacher';
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('kingdomkids_session');
    window.location.hash = '#/login';
  };

  if (hasError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong.</h1>
        <p className="text-gray-600 mb-6">We encountered an error loading your session.</p>
        <button 
          onClick={() => { localStorage.clear(); window.location.reload(); }}
          className="bg-pink-600 text-white px-6 py-2 rounded-full font-bold uppercase tracking-widest"
        >
          Reset Application
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="font-black text-pink-500 uppercase tracking-widest text-[10px]">Syncing Mission...</span>
        </div>
      </div>
    );
  }

  const renderView = () => {
    const path = currentPath.replace('#', '');
    
    if (path === '/login' || !user) {
      return <Login onLogin={handleLogin} />;
    }

    if (path.startsWith('/lesson/')) {
      const id = path.split('/').pop();
      return (
        <LessonDetail 
          lessonId={id!} 
          user={user} 
          onBack={() => {
            window.location.hash = user.role === UserRole.ADMIN ? '#/admin' : '#/teacher';
          }} 
        />
      );
    }

    if (path === '/admin' && user.role === UserRole.ADMIN) {
      return <AdminDashboard user={user} onLogout={handleLogout} />;
    }

    if (path === '/teacher' || (path === '/' && user.role === UserRole.TEACHER)) {
      return <TeacherDashboard user={user} onLogout={handleLogout} />;
    }

    // Default redirect
    window.location.hash = user.role === UserRole.ADMIN ? '#/admin' : '#/teacher';
    return null;
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-pink-100">
      {renderView()}
    </div>
  );
};

export default App;