
import React, { useState, useEffect } from 'react';
import { db } from '../services/supabaseService.ts';
import { Lesson, LessonOccurrence, PlannerConfig, FrequencyType } from '../types.ts';
import { 
  Calendar, RefreshCw, CheckCircle, Settings2, Zap, Play, 
  Trash2, PlusCircle, LayoutGrid, CalendarDays, CalendarRange, 
  AlertOctagon, Info
} from 'lucide-react';

interface PlannerTabProps {
  categories: string[];
}

const PlannerTab: React.FC<PlannerTabProps> = ({ categories }) => {
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const [occurrences, setOccurrences] = useState<LessonOccurrence[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [config, setConfig] = useState<PlannerConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState<FrequencyType | null>(null);
  const [isWiping, setIsWiping] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedCategory]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [occData, lessonData, configData] = await Promise.all([
        db.plannerOccurrences.list(selectedCategory),
        db.lessons.list('admin' as any),
        db.plannerConfigs.get(selectedCategory)
      ]);
      setOccurrences(occData);
      setLessons(lessonData.filter(l => l.status === 'published'));
      
      if (configData) {
        setConfig(configData);
      } else {
        setConfig({
          category: selectedCategory,
          start_date: new Date().toISOString().split('T')[0],
          frequency: 'MONTHLY',
          is_active: true,
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async (updates: Partial<PlannerConfig>) => {
    if (!config) return;
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    try {
      await db.plannerConfigs.upsert(newConfig);
    } catch (e) {
      console.error("Config Update Failed", e);
    }
  };

  const handleTriggerBatch = async (freq: FrequencyType, count: number) => {
    if (!config) return;
    setIsGenerating(freq);
    try {
      // Logic: Start from either today or the last slot in the list
      const latest = occurrences.length > 0 
        ? occurrences[occurrences.length - 1].scheduled_date 
        : config.start_date;
      
      const baseDate = new Date(latest);
      if (occurrences.length > 0) {
        if (freq === 'DAILY') baseDate.setDate(baseDate.getDate() + 1);
        if (freq === 'WEEKLY') baseDate.setDate(baseDate.getDate() + 7);
        if (freq === 'MONTHLY') baseDate.setMonth(baseDate.getMonth() + 1);
      }

      await db.plannerOccurrences.generateBatch(
        selectedCategory, 
        freq, 
        count, 
        baseDate.toISOString().split('T')[0]
      );
      await fetchData();
    } catch (e: any) {
      alert("Trigger failed: " + e.message);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleWipeTimeline = async () => {
    if (!window.confirm(`WARNING: This will delete ALL ${occurrences.length} slots for ${selectedCategory}. Assigned lessons will be unlinked. Proceed?`)) return;
    setIsWiping(true);
    try {
      await db.plannerOccurrences.wipeCategory(selectedCategory);
      setOccurrences([]);
    } catch (e: any) {
      alert("Wipe failed: " + e.message);
    } finally {
      setIsWiping(false);
    }
  };

  const handleAssign = async (occId: string, lessonId: string) => {
    try {
      await db.plannerOccurrences.assignLesson(occId, lessonId);
      setOccurrences(prev => prev.map(o => o.id === occId ? { ...o, lesson_id: lessonId } : o));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    if (!window.confirm("Delete this scheduled slot?")) return;
    try {
      await db.plannerOccurrences.deleteOccurrence(id);
      setOccurrences(prev => prev.filter(o => o.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Generator Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[48px] p-8 shadow-2xl border border-gray-50 relative overflow-hidden flex flex-col gap-8">
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="bg-[#003882] p-4 rounded-3xl text-white shadow-lg"><LayoutGrid size={24} /></div>
                <div>
                  <h2 className="text-xl font-black text-[#003882] uppercase tracking-tighter">Mission Architect</h2>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">Manual Deployment</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Classification</label>
                  <select 
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-50 transition-all cursor-pointer"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-3">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-4 text-center">Trigger New Slots</h3>
                   
                   <button 
                      onClick={() => handleTriggerBatch('DAILY', 7)}
                      disabled={!!isGenerating || isWiping}
                      className="w-full flex items-center justify-between p-5 bg-white border-2 border-slate-50 rounded-[28px] hover:border-[#EF4E92] hover:bg-pink-50 group transition-all disabled:opacity-50"
                   >
                      <div className="flex items-center gap-4">
                         <div className="bg-pink-100 p-3 rounded-2xl text-[#EF4E92] group-hover:bg-[#EF4E92] group-hover:text-white transition-all"><PlusCircle size={20} /></div>
                         <div className="text-left">
                            <p className="font-black text-[11px] uppercase tracking-widest text-slate-800">Add 7 Days</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Daily Cycle</p>
                         </div>
                      </div>
                      {isGenerating === 'DAILY' && <RefreshCw size={18} className="animate-spin text-[#EF4E92]" />}
                   </button>

                   <button 
                      onClick={() => handleTriggerBatch('WEEKLY', 4)}
                      disabled={!!isGenerating || isWiping}
                      className="w-full flex items-center justify-between p-5 bg-white border-2 border-slate-50 rounded-[28px] hover:border-[#003882] hover:bg-blue-50 group transition-all disabled:opacity-50"
                   >
                      <div className="flex items-center gap-4">
                         <div className="bg-blue-100 p-3 rounded-2xl text-[#003882] group-hover:bg-[#003882] group-hover:text-white transition-all"><CalendarDays size={20} /></div>
                         <div className="text-left">
                            <p className="font-black text-[11px] uppercase tracking-widest text-slate-800">Add 4 Weeks</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Weekly Cycle</p>
                         </div>
                      </div>
                      {isGenerating === 'WEEKLY' && <RefreshCw size={18} className="animate-spin text-[#003882]" />}
                   </button>

                   <button 
                      onClick={() => handleTriggerBatch('MONTHLY', 1)}
                      disabled={!!isGenerating || isWiping}
                      className="w-full flex items-center justify-between p-5 bg-white border-2 border-slate-50 rounded-[28px] hover:border-emerald-500 hover:bg-emerald-50 group transition-all disabled:opacity-50"
                   >
                      <div className="flex items-center gap-4">
                         <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all"><CalendarRange size={20} /></div>
                         <div className="text-left">
                            <p className="font-black text-[11px] uppercase tracking-widest text-slate-800">Add 1 Month</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Monthly Cycle</p>
                         </div>
                      </div>
                      {isGenerating === 'MONTHLY' && <RefreshCw size={18} className="animate-spin text-emerald-600" />}
                   </button>
                </div>

                <div className="pt-8 mt-4 border-t border-dashed border-slate-100">
                    <div className="bg-blue-50/50 p-4 rounded-3xl flex gap-3 mb-6">
                      <Info size={16} className="text-[#003882] shrink-0 mt-0.5" />
                      <p className="text-[9px] font-bold text-[#003882] uppercase leading-relaxed tracking-wider">
                        Generation appends to the end of the current timeline using the rules above.
                      </p>
                    </div>

                    <button 
                      onClick={handleWipeTimeline}
                      disabled={isWiping || !!isGenerating || occurrences.length === 0}
                      className="w-full flex items-center justify-center gap-3 py-5 rounded-[28px] border-2 border-red-50 text-red-400 font-black uppercase text-[10px] tracking-widest hover:bg-red-500 hover:text-white hover:border-red-500 transition-all disabled:opacity-30 active:scale-95"
                    >
                      {isWiping ? <RefreshCw size={18} className="animate-spin" /> : <Trash2 size={18} />}
                      WIPE TIMELINE
                    </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Timeline Display */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-4">
             <div className="flex items-center gap-4">
               <div className="w-1.5 h-8 bg-[#EF4E92] rounded-full"></div>
               <h3 className="text-2xl font-black text-[#003882] uppercase tracking-tighter">Timeline Deployment</h3>
             </div>
             <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
               {occurrences.length} Active Slots
             </div>
          </div>

          <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-4 scrollbar-hide pb-20">
            {loading ? (
              <div className="space-y-4">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-20 bg-white rounded-[32px] animate-pulse" />)}
              </div>
            ) : occurrences.length === 0 ? (
              <div className="h-[500px] flex flex-col items-center justify-center bg-white rounded-[64px] border-4 border-dashed border-slate-50 p-12 text-center text-slate-200 shadow-inner">
                <Calendar size={100} className="mb-8 opacity-5" />
                <h4 className="font-black uppercase tracking-[0.4em] text-slate-300 mb-2">Ready for Deployment</h4>
                <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest max-w-[280px] mx-auto leading-relaxed">
                  The schedule for <span className="text-[#EF4E92]">{selectedCategory}</span> is currently empty. Use the Mission Architect to populate it.
                </p>
              </div>
            ) : (
              occurrences.map((occ, idx) => {
                const date = new Date(occ.scheduled_date);
                const isPast = date < new Date(new Date().setHours(0,0,0,0));
                return (
                  <div 
                    key={occ.id} 
                    className={`group flex items-center gap-6 animate-in slide-in-from-right duration-500`}
                    style={{ animationDelay: `${idx * 20}ms` }}
                  >
                    <div className={`w-16 h-16 shrink-0 rounded-3xl border flex flex-col items-center justify-center shadow-sm transition-all ${isPast ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-white border-blue-50'}`}>
                      <span className="text-[9px] font-black text-[#EF4E92] uppercase">{date.toLocaleString('default', { month: 'short' })}</span>
                      <span className="text-lg font-black text-[#003882]">{date.getDate()}</span>
                    </div>

                    <div className={`flex-1 p-5 rounded-[32px] border transition-all flex flex-col sm:flex-row items-center gap-4 ${occ.lesson_id ? 'bg-white border-slate-50 shadow-sm' : 'bg-white border-amber-100 border-dashed border-2 shadow-sm'}`}>
                      <div className="flex-1 min-w-0 w-full">
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 flex items-center gap-2">
                          {date.toLocaleDateString('default', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                          {isPast && <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[7px] text-slate-400">PAST MISSION</span>}
                        </p>
                        <select
                          className={`w-full bg-transparent border-none p-0 font-black text-sm outline-none cursor-pointer appearance-none ${occ.lesson_id ? 'text-[#003882]' : 'text-amber-500 italic'}`}
                          value={occ.lesson_id || ''}
                          onChange={(e) => handleAssign(occ.id, e.target.value)}
                        >
                          <option value="">+ Assign Mission Objective...</option>
                          {lessons.map(l => (
                            <option key={l.id} value={l.id}>{l.title}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                         {occ.lesson_id ? (
                           <div className="bg-emerald-50 text-emerald-500 p-2 rounded-xl border border-emerald-100"><CheckCircle size={20} /></div>
                         ) : (
                           <div className="bg-amber-50 text-amber-500 p-2 rounded-xl border border-amber-100"><AlertOctagon size={20} /></div>
                         )}
                         <button 
                            onClick={() => handleDeleteSlot(occ.id)}
                            className="p-3 text-slate-100 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                          >
                            <Trash2 size={18} />
                         </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlannerTab;
