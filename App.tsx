
import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, AuthUser, Profile } from './types';
import Login from './views/Login';
import TeacherDashboard from './views/TeacherDashboard';
import AdminDashboard from './views/AdminDashboard';
import LessonDetail from './views/LessonDetail';

const App: React.FC = () => {
  const [user, setUser] = useState<AuthUser>(null);
  const [currentPath, setCurrentPath] = useState<string>(window.location.hash || '#/');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for existing session
    const savedUser = localStorage.getItem('kingdomkids_session');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);

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

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  // Router logic
  const renderView = () => {
    const path = currentPath.replace('#', '');
    
    if (path === '/login' || !user) {
      return <Login onLogin={handleLogin} />;
    }

    if (path.startsWith('/lesson/')) {
      const id = path.split('/').pop();
      return <LessonDetail lessonId={id!} user={user} onBack={() => {
        window.location.hash = user.role === UserRole.ADMIN ? '#/admin' : '#/teacher';
      }} />;
    }

    if (path === '/admin' && user.role === UserRole.ADMIN) {
      return <AdminDashboard user={user} onLogout={handleLogout} />;
    }

    if (path === '/teacher' || (path === '/' && user.role === UserRole.TEACHER)) {
      return <TeacherDashboard user={user} onLogout={handleLogout} />;
    }

    // Fallback based on role
    window.location.hash = user.role === UserRole.ADMIN ? '#/admin' : '#/teacher';
    return null;
  };

  return (
    <div className="min-h-screen bg-white text-black">
      {renderView()}
    </div>
  );
};

export default App;
