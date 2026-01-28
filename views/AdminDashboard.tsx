
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/supabaseService.ts';
import { categorizeLessonTitle, generateFullLesson, generateLessonSummary } from '../services/geminiService.ts';
import { Lesson, LessonStatus, UserRole, Profile, LessonActivity, LessonVideo, Attachment, LessonContentStructure, LessonSubSection, LessonSchedule } from '../types.ts';
import { Search, Calendar, Clock, Trash2, Plus, Info, Video, Link, FileText, LayoutGrid, UploadCloud, FileDown, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex items-center gap-3 mb-4 md:mb-6">
    <div className="h-5 md:h-6 w-1 md:w-1.5 bg-[#EF4E92] rounded-full"></div>
    <h3 className="font-black text-lg md:text-xl tracking-tight uppercase text-[#003882]">{title}</h3>
  </div>
);

interface SubSectionCardProps {
  sub: LessonSubSection;
  onUpdate: (updates: Partial<LessonSubSection>) => void;
  onDelete: () => void;
  placeholder: string;
}

const SubSectionCard: React.FC<SubSectionCardProps> = ({
  sub,
  onUpdate,
  onDelete,
  placeholder
}) => {
  const [bibleReference, setBibleReference] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  const isPermanent = ['BIBLE TEXT', 'MEMORY VERSE', 'BIG PICTURE', 'TEACH THE STORY', 'GOSPEL CONNECTION', 'DISCUSSION', 'CRAFTS'].includes(sub.title.toUpperCase());
  const isBibleCard = sub.title.toUpperCase() === 'BIBLE TEXT' || sub.title.toUpperCase() === 'SCRIPTURE';

  // If the content is short and looks like a reference, pre-fill the input
  useEffect(() => {
    if (isBibleCard && sub.content && sub.content.length < 50 && !bibleReference) {
      setBibleReference(sub.content);
    }
  }, [sub.content, isBibleCard]);

  const fetchBibleText = async () => {
    const query = bibleReference || sub.content; // Use input or current content if it acts as ref
    const sanitizedQuery = query.trim().replace(/–|—/g, '-').replace(/\s+/g, '+');
    if (!sanitizedQuery) return alert("Please enter a reference");

    setIsFetching(true);
    try {
      const res = await fetch(`https://bible-api.com/${sanitizedQuery}`);
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      if (data && data.text) onUpdate({ content: data.text.trim() });
    } catch (e) {
      alert("Failed to fetch Bible text. Check the reference format.");
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="bg-white p-5 md:p-6 rounded-[30px] relative shadow-sm border-2 border-transparent hover:border-pink-50 transition-all group flex flex-col min-h-[160px]">
      {!isPermanent && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute top-4 right-6 text-gray-300 hover:text-red-500 transition-colors z-10">
          <Trash2 size={16} />
        </button>
      )}
      <div className="mb-2">
        <div className="w-full text-[10px] font-black uppercase tracking-widest text-gray-600 select-none">{sub.title}</div>
      </div>
      {isBibleCard && (
        <div className="mb-4">
          <div className="flex flex-col gap-2">
            <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-xs focus:border-[#EF4E92] outline-none transition-all" placeholder="Reference (e.g. John 3:16)" value={bibleReference} onChange={e => setBibleReference(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchBibleText()} />
            <button onClick={fetchBibleText} disabled={isFetching} className="w-full h-10 bg-[#003882] text-white rounded-xl flex items-center justify-center gap-2 hover:bg-[#002b66] disabled:opacity-50 transition-all shadow-sm font-black uppercase tracking-widest text-[9px]">
              {isFetching ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span>Fetch Verses</span>}
            </button>
          </div>
        </div>
      )}
      <textarea rows={4} placeholder={placeholder} className="w-full bg-transparent border-none text-sm leading-relaxed outline-none resize-none text-gray-600 font-medium flex-1 scrollbar-hide" value={sub.content} onChange={e => onUpdate({ content: e.target.value })} />
    </div>
  );
};

const DEFAULT_LESSON_TEMPLATE: LessonContentStructure = {
  read: [{ id: 'tpl-r1', title: 'BIBLE TEXT', content: '' }, { id: 'tpl-r2', title: 'MEMORY VERSE', content: '' }],
  teach: [{ id: 'tpl-t1', title: 'BIG PICTURE', content: '' }, { id: 'tpl-t2', title: 'TEACH THE STORY', content: '' }, { id: 'tpl-t3', title: 'GOSPEL CONNECTION', content: '' }],
  engage: [{ id: 'tpl-e1', title: 'DISCUSSION', content: '' }, { id: 'tpl-e2', title: 'CRAFTS', content: '' }]
};

// Updated CSV Interface matching the requested fields
interface CSVRow {
  mission_id?: string;
  mission_name: string;
  classification: string;
  mission_summary: string;
  bible_reference: string;
  memory_verse: string;
  big_picture: string;
  teach_the_story: string;
  gospel_connection: string;
  discussion_questions: string;
  craft_ideas: string;
  activities: string; // Pipe delimited
  video_urls: string; // Pipe delimited
  resource_links: string; // Pipe delimited
}

const AdminDashboard: React.FC<{ user: Profile; onLogout: () => void }> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'LESSONS' | 'SCHEDULE'>('LESSONS');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [schedules, setSchedules] = useState<LessonSchedule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Lesson>>({ 
    title: '', 
    summary: '', 
    content: '', 
    category: 'HISTORY', 
    status: LessonStatus.DRAFT,
    series: 'KingdomKids',
    grade_min: 1,
    grade_max: 6,
    tags: []
  });
  const [structure, setStructure] = useState<LessonContentStructure>({ read: [], teach: [], engage: [] });
  const [activities, setActivities] = useState<Partial<LessonActivity>[]>([]);
  const [videos, setVideos] = useState<Partial<LessonVideo>[]>([]);
  const [attachments, setAttachments] = useState<Partial<Attachment>[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState('');
  const [isScheduleSearchOpen, setIsScheduleSearchOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import Preview State
  const [importPreview, setImportPreview] = useState<CSVRow[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Scheduling State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedLessonId, setSelectedLessonId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([db.lessons.list(UserRole.ADMIN), db.schedules.list()]);
      setLessons(l || []);
      setSchedules(prev => {
        const localOnly = prev.filter(p => p.id.startsWith('temp-'));
        const fetchedIds = new Set((s || []).map(x => x.id));
        const filteredLocals = localOnly.filter(x => !fetchedIds.has(x.id));
        return [...(s || []), ...filteredLocals];
      });
    } catch (e) { 
      console.error("Fetch Data Error:", e); 
    }
    setLoading(false);
  };

  /**
   * --------------------------------------------------------------------------
   * CSV IMPORT / EXPORT LOGIC
   * --------------------------------------------------------------------------
   */
  
  const handleDownloadTemplate = () => {
    // Exact headers requested
    const headers = [
      'mission_id', 'mission_name', 'classification', 'mission_summary',
      'bible_reference', 'memory_verse', 'big_picture', 'teach_the_story',
      'gospel_connection', 'discussion_questions', 'craft_ideas',
      'activities', 'video_urls', 'resource_links'
    ];
    
    // Sample row with list examples
    const sampleRow = [
      '', // mission_id (empty for new)
      'Noah and the Ark', 
      'HISTORY', 
      'God saves Noah from the flood.', 
      'Genesis 6:1-9:17', 
      'Noah found favor in the eyes of the Lord. - Genesis 6:8', 
      'God keeps His promises.', 
      'Tell the story of the flood...', 
      'The Ark is a picture of Jesus saving us.', 
      '1. Why did God send the flood?|2. How big was the ark?', 
      'Animal Mask Craft|Paper Boat Race', 
      'Animal Charades - Act out animals|Rainbow Relay - Run to colors', // Activities (Title - Desc)
      'https://youtube.com/example1|https://vimeo.com/example2', // Videos
      'Coloring Sheet - http://link.com/pdf|Parent Guide - http://link.com/doc' // Resources
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + sampleRow.map(f => `"${String(f).replace(/"/g, '""')}"`).join(","); // Escape quotes
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "kingdom_kids_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset
      fileInputRef.current.click();
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Validate Headers (Loose check to ensure basic structure)
    const required = ['mission_name', 'classification', 'mission_summary'];
    const missing = required.filter(r => !headers.includes(r));
    
    if (missing.length > 0) {
      alert(`Invalid CSV Format. Missing headers: ${missing.join(', ')}`);
      return;
    }

    const parsedRows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      // Handle commas inside quotes
      const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      
      if (matches) {
        const rowData: any = {};
        matches.forEach((val, idx) => {
          if (headers[idx]) {
            // Remove wrapping quotes and unescape double quotes
            rowData[headers[idx]] = val.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
          }
        });
        
        if (rowData.mission_name) {
          parsedRows.push(rowData as CSVRow);
        }
      }
    }
    
    setImportPreview(parsedRows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        parseCSV(text);
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setIsImporting(true);
    let successCount = 0;

    try {
      for (const row of importPreview) {
        // --- 1. Construct Content Markdown ---
        // This maps the CSV fields to the exact sections expected by the Admin UI parser
        const contentMarkdown = 
`# 1. Read

## BIBLE TEXT
${row.bible_reference || ''}

## MEMORY VERSE
${row.memory_verse || ''}

# 2. Teach

## BIG PICTURE
${row.big_picture || ''}

## TEACH THE STORY
${row.teach_the_story || ''}

## GOSPEL CONNECTION
${row.gospel_connection || ''}

# 3. Engage

## DISCUSSION
${row.discussion_questions?.replace(/\|/g, '\n') || ''}

## CRAFTS
${row.craft_ideas?.replace(/\|/g, '\n') || ''}`;

        // --- 2. Parse Activities (Pipe delimited) ---
        // Format: "Title - Instructions" OR just "Title"
        const activitiesPayload: Partial<LessonActivity>[] = [];
        if (row.activities) {
          row.activities.split('|').forEach((actStr, idx) => {
            if (actStr.trim()) {
              const [title, inst] = actStr.split(' - ');
              activitiesPayload.push({
                title: title.trim(),
                instructions: inst ? inst.trim() : 'See teacher guide for details.',
                supplies: [],
                duration_minutes: 15,
                sort_order: idx
              });
            }
          });
        }

        // --- 3. Parse Videos (Pipe delimited) ---
        const videosPayload: Partial<LessonVideo>[] = [];
        if (row.video_urls) {
          row.video_urls.split('|').forEach((url, idx) => {
            if (url.trim()) {
              videosPayload.push({
                title: `Video Resource ${idx + 1}`,
                url: url.trim(),
                provider: url.includes('vimeo') ? 'vimeo' : 'youtube',
                sort_order: idx
              });
            }
          });
        }

        // --- 4. Parse Resources (Pipe delimited) ---
        // Format: "Name - URL"
        const attachmentsPayload: Partial<Attachment>[] = [];
        if (row.resource_links) {
          row.resource_links.split('|').forEach((resStr) => {
            if (resStr.trim()) {
              const [name, url] = resStr.split(' - ');
              if (url) {
                attachmentsPayload.push({
                  name: name.trim(),
                  storage_path: url.trim(),
                  type: 'pdf'
                });
              }
            }
          });
        }

        // --- 5. Main Lesson Payload ---
        const missionPayload: Partial<Lesson> = {
          id: (row.mission_id && row.mission_id.trim()) ? row.mission_id : undefined,
          title: row.mission_name,
          category: row.classification || 'HISTORY',
          summary: row.mission_summary,
          tags: [],
          grade_min: 1,
          grade_max: 6,
          status: LessonStatus.PUBLISHED, // Import as published for immediate use, or change to DRAFT
          content: contentMarkdown,
          created_by: user.id
        };

        await db.lessons.upsert(missionPayload, activitiesPayload, videosPayload, attachmentsPayload);
        successCount++;
      }
      
      alert(`Success! Imported ${successCount} missions.`);
      setImportPreview(null);
      await fetchData();

    } catch (e) {
      console.error(e);
      alert("Import failed. Check console for details.");
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * --------------------------------------------------------------------------
   * END CSV LOGIC
   * --------------------------------------------------------------------------
   */

  const enrichedSchedules = useMemo(() => {
    return schedules.map(sch => {
      const lesson = sch.lesson || lessons.find(l => l.id === sch.lesson_id);
      return { ...sch, lesson };
    });
  }, [schedules, lessons]);

  const filteredLessons = useMemo(() => {
    if (!searchQuery.trim()) return lessons;
    const query = searchQuery.toLowerCase();
    return lessons.filter(l => 
      l.title.toLowerCase().includes(query) || 
      l.category.toLowerCase().includes(query) || 
      (l.summary && l.summary.toLowerCase().includes(query))
    );
  }, [lessons, searchQuery]);

  const alphanumericLessons = useMemo(() => {
    const list = [...lessons]
      .filter(l => l.status === LessonStatus.PUBLISHED)
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));

    if (!scheduleSearchQuery.trim()) return list;
    const query = scheduleSearchQuery.toLowerCase();
    return list.filter(l => l.title.toLowerCase().includes(query));
  }, [lessons, scheduleSearchQuery]);

  const handleEdit = async (id: string) => {
    try {
      const full = await db.lessons.get(id);
      if (full) {
        setEditingId(id);
        setFormData(full);
        setStructure(parseMarkdownToStructure(full.content || ''));
        setActivities(full.activities || []);
        setVideos(full.videos || []);
        setAttachments(full.attachments || []);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) { alert(e); }
  };

  const parseMarkdownToStructure = (md: string) => {
    const newStructure: LessonContentStructure = { read: [], teach: [], engage: [] };
    if (!md) return newStructure;
    const mainSections = md.split(/^# \d\. /m);
    ['read', 'teach', 'engage'].forEach((key, i) => {
      const fullBlock = mainSections[i + 1] || '';
      const parts = fullBlock.split(/^## /m);
      (newStructure as any)[key] = parts.slice(1).filter(s => s.trim()).map(s => {
        const lines = s.split('\n');
        return { id: Math.random().toString(36).substr(2, 9), title: lines[0].trim(), content: lines.slice(1).join('\n').trim() };
      });
    });
    return newStructure;
  };

  const serializeStructureToMarkdown = () => {
    const serializeBox = (title: string, items: LessonSubSection[]) => `# ${title}\n\n` + items.map(i => `## ${i.title}\n${i.content}`).join('\n\n');
    return [serializeBox('1. Read', structure.read), serializeBox('2. Teach', structure.teach), serializeBox('3. Engage', structure.engage)].join('\n\n');
  };

  const handleSave = async (status: LessonStatus) => {
    if (!formData.title) return alert("Title required");
    setLoading(true);
    try {
      const { activities: _a, videos: _v, attachments: _at, progress: _p, ...rest } = formData;
      
      const publishedAt = status === LessonStatus.PUBLISHED 
        ? (formData.published_at || new Date().toISOString()) 
        : formData.published_at;

      await db.lessons.upsert({ 
        ...rest, 
        content: serializeStructureToMarkdown(), 
        status, 
        published_at: publishedAt,
        created_by: user.id,
        summary: formData.summary || '',
        series: formData.series || 'KingdomKids',
        grade_min: formData.grade_min || 1,
        grade_max: formData.grade_max || 6,
        tags: formData.tags || []
      }, activities, videos, attachments);
      
      setEditingId(null);
      await fetchData();
    } catch (e) { 
      console.error("Save failed:", e);
      alert("Error saving lesson: " + (e instanceof Error ? e.message : String(e))); 
    }
    setLoading(false);
  };

  const handleScheduleLesson = async () => {
    if (!selectedLessonId) return alert("Select a mission");
    setLoading(true);
    try {
      const existing = await db.schedules.getForDate(selectedDate);
      
      const payload: any = { 
        lesson_id: selectedLessonId, 
        date: selectedDate           
      };
      
      if (existing) {
        payload.id = existing.id;
      }

      const savedSchedule = await db.schedules.upsert(payload);
      
      if (savedSchedule) {
        const hydratedSchedule = { 
          ...savedSchedule, 
          lesson: lessons.find(l => l.id === savedSchedule.lesson_id) 
        };

        setSchedules(prev => {
          const exists = prev.some(s => s.id === savedSchedule.id);
          if (exists) {
            return prev.map(s => s.id === savedSchedule.id ? hydratedSchedule : s);
          }
          return [...prev, hydratedSchedule].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        });
        
        if (!savedSchedule.id.startsWith('temp-')) {
          await fetchData();
        }
      }

      alert("Mission assigned successfully!");
      setSelectedLessonId('');
    } catch (e) { 
      console.error("Scheduling failed:", e);
      alert("Error: " + (e instanceof Error ? e.message : String(e))); 
    }
    setLoading(false);
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm("Remove this schedule?")) return;
    try {
      setSchedules(prev => prev.filter(s => s.id !== id));
      await db.schedules.delete(id);
      if (!id.startsWith('temp-')) {
        await fetchData();
      }
    } catch (e) { alert(e); }
  };

  const handleNew = () => {
    setEditingId('new');
    setFormData({ 
      title: '', 
      summary: '', 
      content: '', 
      category: 'HISTORY', 
      status: LessonStatus.DRAFT,
      series: 'KingdomKids',
      grade_min: 1,
      grade_max: 6,
      tags: []
    });
    setStructure({ 
      read: DEFAULT_LESSON_TEMPLATE.read.map(i => ({...i, id: Math.random().toString(36).substr(2,9)})),
      teach: DEFAULT_LESSON_TEMPLATE.teach.map(i => ({...i, id: Math.random().toString(36).substr(2,9)})),
      engage: DEFAULT_LESSON_TEMPLATE.engage.map(i => ({...i, id: Math.random().toString(36).substr(2,9)}))
    });
    setActivities([]); setVideos([]); setAttachments([]);
  };

  const addVideo = () => setVideos([...videos, { title: '', url: '', provider: 'youtube' }]);
  const addResource = () => setAttachments([...attachments, { name: '', storage_path: '', type: 'image' }]);
  const addActivity = () => setActivities([...activities, { title: '', instructions: '', duration_minutes: 15, supplies: [] }]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-6 md:px-10 py-4 md:py-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-[#EF4E92] w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center font-black text-white shadow-lg">K</div>
          <h1 className="text-xs md:text-sm font-black tracking-tight text-gray-900 uppercase">KingdomKids Admin</h1>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-full">
          <button onClick={() => setActiveTab('LESSONS')} className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'LESSONS' ? 'bg-[#003882] text-white shadow-md' : 'text-gray-400'}`}>Missions</button>
          <button onClick={() => setActiveTab('SCHEDULE')} className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'SCHEDULE' ? 'bg-[#003882] text-white shadow-md' : 'text-gray-400'}`}>Scheduling</button>
        </div>
        <button onClick={onLogout} className="text-[10px] font-black uppercase text-[#EF4E92] tracking-widest">Logout</button>
      </header>

      {/* --- IMPORT PREVIEW MODAL --- */}
      {importPreview && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="bg-pink-100 p-3 rounded-xl text-[#EF4E92]">
                  <UploadCloud size={24} />
                </div>
                <div>
                  <h3 className="font-black text-xl text-[#003882] uppercase tracking-tight">Import Preview</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Review {importPreview.length} missions before importing</p>
                </div>
              </div>
              <button onClick={() => setImportPreview(null)} className="p-3 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-8">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Mission Name</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Classification</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {importPreview.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-4">
                        {row.mission_id ? (
                           <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Update</span>
                        ) : (
                           <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">New</span>
                        )}
                      </td>
                      <td className="py-4 px-4 font-bold text-gray-800">{row.mission_name}</td>
                      <td className="py-4 px-4 text-xs font-medium text-gray-500">{row.classification}</td>
                      <td className="py-4 px-4 text-xs font-medium text-gray-500 truncate max-w-xs">{row.mission_summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-8 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-4">
              <button 
                onClick={() => setImportPreview(null)}
                className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmImport}
                disabled={isImporting}
                className="bg-[#EF4E92] text-white px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#d83a7c] transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isImporting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                {isImporting ? 'Processing...' : 'Confirm Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto p-6 md:p-8">
        {activeTab === 'LESSONS' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Sidebar List */}
            <div className={`lg:col-span-3 space-y-6 ${editingId ? 'hidden lg:block' : 'block'}`}>
              
              {/* Admin Actions Bar */}
              <div className="bg-white p-4 rounded-[28px] border border-gray-100 shadow-sm space-y-3">
                <div className="flex items-center gap-2 mb-2">
                   <div className="bg-pink-50 p-1.5 rounded-lg text-[#EF4E92]"><Info size={14} /></div>
                   <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Admin Actions</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="file" 
                    accept=".csv" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileUpload}
                  />
                  <button 
                    onClick={handleImportClick}
                    className="bg-gradient-to-r from-[#FF4B91] to-[#FF80B5] text-white py-3 rounded-2xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-1 group active:scale-95"
                  >
                      <UploadCloud size={20} className="group-hover:animate-bounce" />
                      <span className="text-[8px] font-black uppercase tracking-widest">Upload CSV</span>
                  </button>
                  <button 
                    onClick={handleDownloadTemplate}
                    className="bg-white border-2 border-[#003882]/10 text-[#003882] py-3 rounded-2xl hover:bg-blue-50 transition-all active:scale-95 shadow-sm flex flex-col items-center justify-center gap-1"
                  >
                      <FileDown size={20} />
                      <span className="text-[8px] font-black uppercase tracking-widest">Template</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h2 className="font-black text-2xl tracking-tighter text-[#003882]">Missions</h2>
                <button onClick={handleNew} className="bg-[#EF4E92] text-white px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">+ NEW</button>
              </div>

              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#EF4E92] transition-colors">
                  <Search size={16} />
                </div>
                <input 
                  type="text" 
                  placeholder="Search missions..." 
                  className="w-full bg-white border border-gray-100 rounded-[28px] pl-11 pr-4 py-4 text-xs font-black uppercase tracking-widest outline-none focus:border-[#EF4E92] transition-all shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hide pr-2">
                {filteredLessons.length === 0 ? (
                  <div className="p-8 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest border-2 border-dashed border-gray-50 rounded-[28px]">
                    No missions found
                  </div>
                ) : (
                  filteredLessons.map(l => (
                    <div key={l.id} onClick={() => handleEdit(l.id)} className={`p-5 rounded-[28px] border transition-all cursor-pointer bg-white group ${editingId === l.id ? 'border-pink-500 bg-pink-50/30 shadow-lg' : 'border-gray-50 hover:border-gray-200 shadow-sm'}`}>
                      <h3 className="font-bold text-sm text-gray-800 mb-1">{l.title || 'Untitled'}</h3>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{l.category}</p>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${l.status === LessonStatus.PUBLISHED ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>{l.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Editor Area */}
            <div className={`lg:col-span-9 ${!editingId ? 'hidden lg:block' : 'block'}`}>
              {!editingId ? (
                <div className="h-[70vh] flex flex-col items-center justify-center bg-white rounded-[64px] border border-gray-100 text-gray-300 p-12 text-center shadow-sm">
                  <p className="font-black uppercase tracking-[0.3em] text-[10px]">Select a mission to begin editing</p>
                </div>
              ) : (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
                  <div className="bg-white/95 backdrop-blur-md p-4 rounded-full border border-gray-100 shadow-xl flex items-center justify-between sticky top-[92px] z-40 gap-3">
                    <h2 className="font-black text-md px-4 text-[#003882] truncate">{formData.title || 'Draft Lesson'}</h2>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditingId(null)} className="px-4 py-2 text-[10px] font-black uppercase text-gray-400 tracking-widest">Discard</button>
                      <button onClick={() => handleSave(LessonStatus.DRAFT)} disabled={loading} className="px-6 py-3 bg-[#003882] rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg disabled:opacity-50">
                        {loading ? '...' : 'Draft'}
                      </button>
                      <button onClick={() => handleSave(LessonStatus.PUBLISHED)} disabled={loading} className="px-8 py-3 bg-[#EF4E92] rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg disabled:opacity-50">
                        {loading ? '...' : 'Publish'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <SectionHeader title="Mission Name" />
                      <input className="w-full bg-white border border-gray-100 rounded-[28px] px-6 py-5 font-black text-xl text-gray-800 outline-none shadow-sm focus:border-pink-300 transition-all" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    </div>
                    <div className="space-y-3">
                      <SectionHeader title="Classification" />
                      <select className="w-full bg-white border border-gray-100 rounded-[28px] px-6 py-5 text-xs font-black outline-none shadow-sm focus:border-pink-300" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                        <option value="PENTATEUCH">PENTATEUCH</option>
                        <option value="HISTORY">HISTORY</option>
                        <option value="POETRY">POETRY</option>
                        <option value="THE PROPHETS">THE PROPHETS</option>
                        <option value="THE GOSPELS">THE GOSPELS</option>
                        <option value="ACTS & EPISTLES">ACTS & EPISTLES</option>
                        <option value="REVELATION">REVELATION</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <SectionHeader title="Mission Summary" />
                    <textarea 
                      className="w-full bg-white border border-gray-100 rounded-[28px] px-6 py-5 font-medium text-sm text-gray-600 outline-none shadow-sm focus:border-pink-300 transition-all min-h-[100px] resize-none" 
                      placeholder="Brief mission briefing for teachers..."
                      value={formData.summary} 
                      onChange={e => setFormData({...formData, summary: e.target.value})} 
                    />
                  </div>

                  <div className="space-y-6">
                    <SectionHeader title="Lesson Body" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {(['read', 'teach', 'engage'] as const).map((col) => (
                        <div key={col} className="bg-gray-50/60 rounded-[48px] p-8 flex flex-col min-h-[500px] border border-gray-100/50">
                          <h4 className="font-black text-xs text-[#003882] uppercase tracking-[0.2em] mb-6">{col}</h4>
                          <div className="space-y-4">
                            {structure[col].map(sub => (
                              <SubSectionCard key={sub.id} sub={sub} onUpdate={updates => setStructure(prev => ({...prev, [col]: prev[col].map(s => s.id === sub.id ? {...s, ...updates} : s)}))} onDelete={() => setStructure(prev => ({...prev, [col]: prev[col].filter(s => s.id !== sub.id)}))} placeholder={`Content...`} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between pr-6">
                      <SectionHeader title="Interactive Activities" />
                      <button onClick={addActivity} className="bg-[#EF4E92] text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-[#d83a7c] transition-all">
                        <Plus size={16} strokeWidth={3} /> ADD ACTIVITY
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {activities.length === 0 ? (
                        <div className="col-span-full bg-gray-50/50 p-12 rounded-[48px] border-2 border-dashed border-gray-200 text-center">
                          <p className="text-gray-300 font-black uppercase tracking-widest text-[10px]">No activities defined</p>
                        </div>
                      ) : (
                        activities.map((act, idx) => (
                          <div key={idx} className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 relative group animate-in zoom-in-95">
                            <button onClick={() => setActivities(activities.filter((_, i) => i !== idx))} className="absolute top-6 right-8 text-gray-300 hover:text-red-500 transition-colors z-10">
                              <Trash2 size={18} />
                            </button>
                            <div className="space-y-4">
                              <input 
                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 text-sm font-black text-gray-800 outline-none focus:border-[#EF4E92] transition-all"
                                placeholder={`Option ${idx + 1}: Activity Title`}
                                value={act.title}
                                onChange={e => setActivities(activities.map((a, i) => i === idx ? {...a, title: e.target.value} : a))}
                              />
                              <textarea 
                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 text-sm font-medium text-gray-600 outline-none focus:border-[#EF4E92] transition-all resize-none min-h-[160px]"
                                placeholder="Step-by-step instructions..."
                                value={act.instructions}
                                onChange={e => setActivities(activities.map((a, i) => i === idx ? {...a, instructions: e.target.value} : a))}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between pr-6">
                      <SectionHeader title="Videos & Media" />
                      <button onClick={addVideo} className="bg-[#003882] text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-[#002b66] transition-all">
                        <Plus size={16} strokeWidth={3} /> ADD VIDEO
                      </button>
                    </div>
                    <div className="space-y-4">
                      {videos.length === 0 ? (
                        <div className="bg-gray-50/50 p-12 rounded-[48px] border-2 border-dashed border-gray-200 text-center">
                          <p className="text-gray-300 font-black uppercase tracking-widest text-[10px]">No videos attached</p>
                        </div>
                      ) : (
                        videos.map((vid, idx) => (
                          <div key={idx} className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 relative group animate-in zoom-in-95">
                            <button onClick={() => setVideos(videos.filter((_, i) => i !== idx))} className="absolute top-6 right-6 text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 size={18} />
                            </button>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="relative">
                                <input 
                                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-3xl px-6 py-4 text-sm font-bold outline-none focus:border-[#EF4E92] transition-all"
                                  placeholder="Video Title"
                                  value={vid.title}
                                  onChange={e => setVideos(videos.map((v, i) => i === idx ? {...v, title: e.target.value} : v))}
                                />
                              </div>
                              <div className="relative">
                                <input 
                                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-3xl px-6 py-4 text-sm font-bold outline-none focus:border-[#EF4E92] transition-all"
                                  placeholder="YouTube or Vimeo URL"
                                  value={vid.url}
                                  onChange={e => setVideos(videos.map((v, i) => i === idx ? {...v, url: e.target.value} : v))}
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between pr-6">
                      <SectionHeader title="Resources & Downloads" />
                      <button onClick={addResource} className="bg-[#EF4E92] text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-[#d83a7c] transition-all">
                        <Plus size={16} strokeWidth={3} /> ADD RESOURCE
                      </button>
                    </div>
                    <div className="space-y-4">
                      {attachments.length === 0 ? (
                        <div className="bg-gray-50/50 p-12 rounded-[48px] border-2 border-dashed border-gray-200 text-center">
                          <p className="text-gray-300 font-black uppercase tracking-widest text-[10px]">No resources attached</p>
                        </div>
                      ) : (
                        attachments.map((att, idx) => (
                          <div key={idx} className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 relative group animate-in zoom-in-95">
                            <button onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))} className="absolute top-6 right-6 text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 size={18} />
                            </button>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <input 
                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-3xl px-6 py-4 text-sm font-bold outline-none focus:border-[#EF4E92] transition-all"
                                placeholder="Resource Name (e.g. Coloring Sheet)"
                                value={att.name}
                                onChange={e => setAttachments(attachments.map((a, i) => i === idx ? {...a, name: e.target.value} : a))}
                              />
                              <input 
                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-3xl px-6 py-4 text-sm font-bold outline-none focus:border-[#EF4E92] transition-all"
                                placeholder="URL to PDF/Image"
                                value={att.storage_path}
                                onChange={e => setAttachments(attachments.map((a, i) => i === idx ? {...a, storage_path: e.target.value} : a))}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* SCHEDULING TAB */
          <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="bg-white rounded-[64px] p-12 border border-gray-100 shadow-xl space-y-10">
              <div>
                <h2 className="text-3xl font-black text-[#003882] tracking-tighter uppercase mb-4">Scheduling</h2>
                <p className="text-slate-400 font-medium">Assign a specific lesson for upcoming dates. Teachers will only see the assigned mission for today starting at 01:00 AM (London Time).</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4">Deployment Date</label>
                  <input type="date" className="w-full bg-gray-50 border-2 border-gray-100 rounded-[32px] px-8 py-5 text-sm font-black outline-none focus:border-[#EF4E92] transition-all" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Assigned Mission</label>
                    <button 
                      onClick={() => setIsScheduleSearchOpen(!isScheduleSearchOpen)}
                      className={`text-[#EF4E92] transition-all p-1 hover:scale-110 active:scale-95 ${isScheduleSearchOpen ? 'bg-pink-50 rounded-full' : ''}`}
                    >
                      <Search size={16} />
                    </button>
                  </div>
                  {isScheduleSearchOpen && (
                    <div className="px-4 animate-in slide-in-from-top-2">
                      <input 
                        type="text" 
                        placeholder="Search available lessons..." 
                        className="w-full bg-pink-50/30 border border-pink-100 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none"
                        value={scheduleSearchQuery}
                        onChange={e => setScheduleSearchQuery(e.target.value)}
                      />
                    </div>
                  )}
                  <select 
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-[32px] px-8 py-5 text-sm font-black outline-none focus:border-[#EF4E92] transition-all" 
                    value={selectedLessonId} 
                    onChange={e => setSelectedLessonId(e.target.value)}
                  >
                    <option value="">Select a mission...</option>
                    {alphanumericLessons.map(l => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                onClick={handleScheduleLesson} 
                disabled={loading}
                className="w-full bg-[#EF4E92] text-white rounded-full py-6 font-black uppercase tracking-widest shadow-lg shadow-pink-200 hover:scale-[1.01] transition-all disabled:opacity-50"
              >
                {loading ? "Processing..." : "Assign Mission"}
              </button>
            </div>

            <div className="space-y-6">
              <h3 className="font-black text-xl uppercase tracking-widest text-[#003882] px-6">Scheduled Deployment</h3>
              <div className="space-y-4">
                {enrichedSchedules.length === 0 ? (
                  <div className="bg-white p-12 rounded-[48px] border-2 border-dashed border-gray-100 text-center">
                    <p className="text-gray-300 font-black uppercase tracking-widest text-[10px]">No schedules currently active</p>
                  </div>
                ) : (
                  enrichedSchedules.map(sch => (
                    <div key={sch.id} className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm flex items-center justify-between group">
                      <div className="flex items-center gap-8">
                        <div className="flex flex-col items-center justify-center bg-slate-50 w-20 h-20 rounded-3xl border border-slate-100">
                          <span className="text-[10px] font-black uppercase text-pink-500">{new Date(sch.date).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}</span>
                          <span className="text-2xl font-black text-[#003882]">{new Date(sch.date).getUTCDate()}</span>
                        </div>
                        <div>
                          <h4 className="font-black text-[#003882] uppercase text-lg">{sch.lesson?.title || 'Unknown Mission'}</h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{sch.lesson?.category || 'General'}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteSchedule(sch.id)} className="text-gray-200 hover:text-red-500 transition-colors p-4">
                        <Trash2 size={24} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
