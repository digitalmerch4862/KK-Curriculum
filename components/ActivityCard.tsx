
import React from 'react';
import { LessonActivity } from '../types';

interface ActivityCardProps {
  activity: LessonActivity;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold">{activity.title}</h3>
        <span className="bg-pink-50 text-pink-600 px-3 py-1 rounded-full text-xs font-semibold">
          {activity.duration_minutes} mins
        </span>
      </div>
      
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">Supplies</h4>
          <ul className="flex flex-wrap gap-2">
            {activity.supplies.map((item, idx) => (
              <li key={idx} className="bg-gray-50 text-gray-700 px-2 py-1 rounded text-sm border border-gray-100">
                {item}
              </li>
            ))}
          </ul>
        </div>
        
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">Instructions</h4>
          <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
            {activity.instructions}
          </div>
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-50 flex justify-end">
        <button 
          onClick={() => window.print()}
          className="text-pink-500 hover:text-pink-600 text-sm font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Friendly
        </button>
      </div>
    </div>
  );
};

export default ActivityCard;
