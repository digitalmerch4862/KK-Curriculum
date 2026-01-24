import React from 'react';
import { UserRole, Profile } from '../types.ts';

interface LoginProps {
  onLogin: (profile: Profile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const profiles: Profile[] = [
    { 
      id: 'd6e6a105-e4d0-4965-9856-d748f32386a3', 
      role: UserRole.ADMIN, 
      name: 'Admin Coordinator', 
      created_at: new Date().toISOString() 
    },
    { 
      id: 'f33b6644-8d48-4c6e-8e3b-b0b3d8f8a652', 
      role: UserRole.TEACHER, 
      name: 'Lead Teacher Sarah', 
      created_at: new Date().toISOString() 
    }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-[48px] p-12 shadow-2xl border border-gray-100">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-black mb-1 text-[#EF4E92] uppercase tracking-tighter">
            KINGDOM KIDS
          </h1>
          <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">
            Faith Pathway
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-center text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8">
            Sign in as
          </p>
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => onLogin(p)}
              className="w-full py-5 px-8 rounded-3xl flex items-center justify-between border-2 border-[#EF4E92] text-[#EF4E92] hover:bg-[#EF4E92] hover:text-white transition-all group shadow-sm hover:shadow-lg active:scale-[0.98]"
            >
              <div className="text-left">
                <p className="font-black text-xl uppercase tracking-tight">
                  {p.role === UserRole.ADMIN ? 'Administrator' : 'Teacher'}
                </p>
              </div>
              <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          ))}
        </div>
        
        <div className="mt-16 text-center text-[10px] font-black uppercase tracking-widest text-gray-200">
          KKFP v1.0
        </div>
      </div>
    </div>
  );
};

export default Login;