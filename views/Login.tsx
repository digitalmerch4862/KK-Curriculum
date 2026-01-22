
import React from 'react';
import { UserRole, Profile } from '../types';

interface LoginProps {
  onLogin: (profile: Profile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const profiles: Profile[] = [
    { id: '1', role: UserRole.ADMIN, name: 'Admin Coordinator', created_at: '' },
    { id: '2', role: UserRole.TEACHER, name: 'Lead Teacher', created_at: '' }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-10 shadow-xl border border-gray-100">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-pink-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-pink-200">
            <span className="text-white text-2xl font-bold">K</span>
          </div>
          <h1 className="text-2xl font-black mb-1">KingdomKids</h1>
          <p className="text-gray-400 font-medium">Teacher Portal</p>
        </div>

        <div className="space-y-4">
          <p className="text-center text-sm text-gray-500 mb-6">Choose your role to sign in</p>
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => onLogin(p)}
              className={`w-full py-4 px-6 rounded-2xl flex items-center justify-between border-2 transition-all group ${
                p.role === UserRole.ADMIN 
                  ? 'border-gray-900 hover:bg-gray-900 hover:text-white' 
                  : 'border-pink-500 hover:bg-pink-500 hover:text-white'
              }`}
            >
              <div className="text-left">
                <p className="font-bold text-lg">{p.role === UserRole.ADMIN ? 'Administrator' : 'Teacher'}</p>
                <p className={`text-xs opacity-60`}>Demo as {p.name}</p>
              </div>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          ))}
        </div>
        
        <div className="mt-12 text-center text-xs text-gray-300">
          KingdomKids Materials Management v1.0
        </div>
      </div>
    </div>
  );
};

export default Login;
