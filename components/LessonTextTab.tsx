import React, { useMemo, useEffect, useState, useRef } from 'react';

export interface SubSection {
  id: string;
  title: string;
  content: string;
}

export interface Section {
  id: string;
  title: string;
  subsections: SubSection[];
}

interface LessonTextTabProps {
  content: string;
  activeReadingId?: string | null;
  onActiveIdChange?: (id: string | null) => void;
  isPlaying?: boolean;
}

export const parseContent = (content: string): Section[] => {
  const parsed: Section[] = [];
  const mainParts = content.split(/^# /m).filter(p => p.trim());

  mainParts.forEach((part, index) => {
    const lines = part.split('\n');
    const title = lines[0].trim();
    const sectionId = `section-${index}`;
    
    const subParts = part.slice(title.length).split(/^## /m).filter(p => p.trim());
    
    const subsections: SubSection[] = subParts.map((sub, sIdx) => {
      const subLines = sub.split('\n');
      const subTitle = subLines[0].trim();
      const subContent = subLines.slice(1).join('\n').trim();
      return {
        id: `${sectionId}-sub-${sIdx}`,
        title: subTitle,
        content: subContent
      };
    });

    parsed.push({ id: sectionId, title, subsections });
  });

  return parsed;
};

const getIcon = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('bible') || t.includes('read') || t.includes('text')) {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    );
  }
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
};

const LessonTextTab: React.FC<LessonTextTabProps> = ({ 
  content, 
  activeReadingId, 
  onActiveIdChange,
  isPlaying = false 
}) => {
  const sections = useMemo(() => parseContent(content), [content]);
  const [isManualScroll, setIsManualScroll] = useState(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // ✅ FIX 4: MANAGE INTERSECTION OBSERVER PRIORITY
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Only update activeId if NOT currently playing OR if we're manually scrolling
        if (!isPlaying || isManualScroll) {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
              onActiveIdChange?.(entry.target.id);
            }
          });
        }
      },
      { threshold: 0.5 }
    );

    const cards = document.querySelectorAll('[data-segment-card]');
    cards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, [isPlaying, isManualScroll, onActiveIdChange]);

  // ✅ DETECT MANUAL SCROLL
  useEffect(() => {
    const handleScroll = () => {
      setIsManualScroll(true);
      if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = window.setTimeout(() => {
        setIsManualScroll(false);
      }, 1500);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const renderFormattedContent = (text: string) => {
    return text.split('\n\n').map((paragraph, pIdx) => (
      <p key={pIdx} className="mb-6 leading-relaxed text-gray-800">{paragraph}</p>
    ));
  };

  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {sections.map((section) => (
        <div key={section.id} id={section.id} className="scroll-mt-32">
          <div className="flex items-center gap-6 mb-10">
            <h2 className="shrink-0 text-sm font-black uppercase tracking-[0.3em] text-[#EF4E92]">
              {section.title}
            </h2>
            <div className="flex-1 h-px bg-gray-100"></div>
          </div>
          
          <div className="space-y-6">
            {section.subsections.map((sub) => {
              const isActive = activeReadingId === sub.id;
              return (
                <section 
                  key={sub.id} 
                  id={sub.id} 
                  data-segment-card // ✅ FIX 5: CRITICAL FOR OBSERVER
                  className={`bg-white rounded-[40px] p-8 md:p-10 shadow-sm border-4 transition-all group scroll-mt-32 duration-500 ${
                    isActive 
                    ? 'border-[#EF4E92] border-4 ring-8 ring-pink-50 shadow-2xl scale-[1.01]' 
                    : 'border-gray-50 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                      isActive ? 'bg-[#EF4E92] text-white scale-110 rotate-3' : 'bg-pink-50 text-[#EF4E92] group-hover:bg-[#EF4E92] group-hover:text-white'
                    }`}>
                      {getIcon(sub.title)}
                    </div>
                    <h3 className={`text-2xl font-black tracking-tight transition-colors ${
                      isActive ? 'text-[#EF4E92]' : 'text-gray-900'
                    }`}>
                      {sub.title}
                    </h3>
                  </div>
                  <div className="text-lg md:text-xl font-serif text-gray-800 leading-relaxed selection:bg-pink-100">
                    {renderFormattedContent(sub.content)}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LessonTextTab;