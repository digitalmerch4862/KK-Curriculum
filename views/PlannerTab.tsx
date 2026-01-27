
import React, { useState, useEffect } from 'react';
import { db } from '../services/supabaseService.ts';
import { Lesson, LessonOccurrence, PlannerConfig, FrequencyType } from '../types.ts';
import { 
  Calendar, RefreshCw, CheckCircle, Settings2, Zap, Play, 
  Trash2, PlusCircle, LayoutGrid, CalendarDays, CalendarRange, 
  AlertOctagon, Info, Send, Target, MousePointer2
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

  // Manual Dispatch State
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [dispatchLessonId, setDispatchLessonId] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);

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

  const handleManualDispatch = async () => {
    if (!dispatchDate || !dispatchLessonId) {
      return alert("Please select both a date and a lesson objective.");
    }
    
    setIsDispatching(true);
    try {
      await db.plannerOccurrences.upsertOccurrence(selectedCategory, dispatchDate, dispatchLessonId);
      await fetchData();
      setDispatchLessonId(''); // Reset selector
    } catch (e: any) {
      alert("Deployment failed: " + e.message);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleTriggerBatch = async (freq: FrequencyType, count: number) => {
    if (!config) return;
    setIsGenerating(freq);
    try {
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
          
          {/* CATEGORY SELECTOR */}
          <div className="bg-[#003882] rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
             <div className="absolute top-[-20px] right-[-20px] opacity-10 rotate-12"><LayoutGrid size={150} /></div>
             <div className="relative z-10">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-blue-300 mb-4">Current Department</label>
                <select 
                  className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-pink-500 transition-all cursor-pointer text-white backdrop-blur-md"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categories.map(c => <option key={c} value={c} className="text-navy-900">{c}</option>)}
                </select>
             </div>
          </div>

          {/* TARGETED DISPATCH (NEW FEATURE) */}
          <div className="bg-white rounded-[40px] p-8 shadow-xl border-2 border-pink-50 space-y-6">
            <div className="flex items-center gap-4 mb-2">
               <div className="bg-pink-100 p-3 rounded-2xl text-[#EF4E92]"><Target size={20} /></div>
               <div>
                  <h3 className="text-md font-black text-[#003882] uppercase tracking-tighter">Targeted Dispatch</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Manual Point Scheduling</p>
               </div>
            </div>

            <div className="space-y-4">
               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Mission Date</label>
                  <input 
                    type="date"
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-[#EF4E92] transition-all"
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                  />
               </div>

               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Objective</label>
                  <select 
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-[#EF4E92] transition-all cursor-pointer"
                    value={dispatchLessonId}
                    onChange={(e) => setDispatchLessonId(e.target.value)}
                  >
                    <option value="">Select Lesson...</option>
                    {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
               </div>

               <button 
                onClick={handleManualDispatch}
                disabled={isDispatching || !dispatchLessonId}
                className="w-full bg-[#EF4E92] text-white py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-pink-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:hover:scale-100"
               >
                 {isDispatching ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                 Deploy Mission
               </button>
            </div>
          </div>

          {/* QUICK REPLENISH (FORMER BATCH TRIGGERS) */}
          <div className="bg-slate-50 rounded-[40px] p-8 border border-slate-100">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 text-center">Batch Deployment</h4>
             <div className="space-y-3">
                <button 
                   onClick={() => handleTriggerBatch('DAILY', 7)}
                   disabled={!!isGenerating || isWiping}
                   className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-[#EF4E92] group transition-all disabled:opacity-50"
                >
                   <div className="flex items-center gap-3">
                      <div className="bg-pink-50 p-2 rounded-xl text-[#EF4E92] group-hover:bg-[#EF4E92] group-hover:text-white transition-all"><PlusCircle size={18} /></div>
                      <span className="font-black text-[10px] uppercase tracking-widest text-slate-700">Next 7 Days</span>
                   </div>
                   {isGenerating === 'DAILY' && <RefreshCw size={14} className="animate-spin text-[#EF4E92]" />}
                </button>

                <button 
                   onClick={() => handleTriggerBatch('WEEKLY', 4)}
                   disabled={!!isGenerating || isWiping}
                   className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-[#003882] group transition-all disabled:opacity-50"
                >
                   <div className="flex items-center gap-3">
                      <div className="bg-blue-50 p-2 rounded-xl text-[#003882] group-hover:bg-[#003882] group-hover:text-white transition-all"><CalendarDays size={18} /></div>
                      <span className="font-black text-[10px] uppercase tracking-widest text-slate-700">Next 4 Weeks</span>
                   </div>
                   {isGenerating === 'WEEKLY' && <RefreshCw size={14} className="animate-spin text-[#003882]" />}
                </button>
             </div>

             <button 
                onClick={handleWipeTimeline}
                disabled={isWiping || !!isGenerating || occurrences.length === 0}
                className="w-full mt-8 flex items-center justify-center gap-2 py-4 rounded-2xl text-red-300 font-black uppercase text-[9px] tracking-widest hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30"
              >
                {isWiping ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Wipe Timeline
              </button>
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
               {occurrences.length} Total Nodes
             </div>
          </div>

          <div className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto pr-4 scrollbar-hide pb-20">
            {loading ? (
              <div className="space-y-4">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 bg-white rounded-[32px] animate-pulse" />)}
              </div>
            ) : occurrences.length === 0 ? (
              <div className="h-[500px] flex flex-col items-center justify-center bg-white rounded-[64px] border-4 border-dashed border-slate-50 p-12 text-center text-slate-200 shadow-inner">
                <Calendar size={100} className="mb-8 opacity-5" />
                <h4 className="font-black uppercase tracking-[0.4em] text-slate-300 mb-2">Ready for Deployment</h4>
                <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest max-w-[280px] mx-auto leading-relaxed">
                  Timeline is clear. Use Targeted Dispatch for specific dates or Batch Deployment for rapid scheduling.
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
                    style={{ animationDelay: `${idx * 15}ms` }}
                  >
                    <div className={`w-16 h-20 shrink-0 rounded-3xl border-2 flex flex-col items-center justify-center shadow-sm transition-all ${isPast ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-blue-50'}`}>
                      <span className="text-[9px] font-black text-[#EF4E92] uppercase leading-none mb-1">{date.toLocaleString('default', { month: 'short' })}</span>
                      <span className="text-xl font-black text-[#003882] leading-none">{date.getDate()}</span>
                    </div>

                    <div className={`flex-1 p-6 rounded-[32px] border-2 transition-all flex flex-col sm:flex-row items-center gap-6 ${occ.lesson_id ? 'bg-white border-white shadow-lg' : 'bg-white border-amber-100 border-dashed shadow-sm'}`}>
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex items-center gap-3 mb-2">
                           <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                             {date.toLocaleDateString('default', { weekday: 'long', day: 'numeric', month: 'long' })}
                           </p>
                           {isPast && <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[7px] font-black text-slate-400 uppercase tracking-tighter">Past Objective</span>}
                        </div>
                        <select
                          className={`w-full bg-transparent border-none p-0 font-black text-base outline-none cursor-pointer appearance-none ${occ.lesson_id ? 'text-[#003882]' : 'text-amber-500 italic'}`}
                          value={occ.lesson_id || ''}
                          onChange={(e) => handleAssign(occ.id, e.target.value)}
                        >
                          <option value="">+ Assign Objective...</option>
                          {lessons.map(l => (
                            <option key={l.id} value={l.id}>{l.title}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                         {occ.lesson_id ? (
                           <div className="bg-emerald-50 text-emerald-500 p-3 rounded-2xl border border-emerald-100"><CheckCircle size={20} /></div>
                         ) : (
                           <div className="bg-amber-50 text-amber-500 p-3 rounded-2xl border border-amber-100 animate-pulse"><AlertOctagon size={20} /></div>
                         )}
                         <button 
                            onClick={() => handleDeleteSlot(occ.id)}
                            className="p-3 text-slate-100 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                          >
                            <Trash2 size={20} />
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
