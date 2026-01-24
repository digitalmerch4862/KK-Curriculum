import React, { useMemo } from 'react';

// Exporting interfaces to be used by other components
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
}

/**
 * Parses markdown-like content into a structured format for the lesson pathway.
 */
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

    parsed.push({
      id: sectionId,
      title,
      subsections
    });
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
  if (t.includes('verse') || t.includes('memory')) {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    );
  }
  if (t.includes('picture') || t.includes('bulb') || t.includes('idea')) {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    );
  }
  if (t.includes('teach') || t.includes('story')) {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    );
  }
  if (t.includes('gospel') || t.includes('connection')) {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    );
  }
  if (t.includes('discussion') || t.includes('talk') || t.includes('question')) {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
      </svg>
    );
  }
  if (t.includes('craft') || t.includes('engage') || t.includes('activity')) {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    );
  }
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
};

const LessonTextTab: React.FC<LessonTextTabProps> = ({ content, activeReadingId }) => {
  const sections = useMemo(() => parseContent(content), [content]);

  const renderFormattedContent = (text: string) => {
    return text.split('\n\n').map((paragraph, pIdx) => {
      const dropCapMatch = paragraph.match(/^(\d+)\s(.*)/);
      if (dropCapMatch) {
        const [, number, rest] = dropCapMatch;
        return (
          <p key={pIdx} className="mb-6 leading-relaxed text-gray-800 relative">
            <span className="float-left text-6xl font-black text-[#EF4E92] mr-3 mt-1 leading-[0.8] font-serif">
              {number}
            </span>
            {rest}
          </p>
        );
      }
      return <p key={pIdx} className="mb-6 leading-relaxed text-gray-800">{paragraph}</p>;
    });
  };

  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {sections.map((section) => (
        <div key={section.id} id={section.id} className="scroll-mt-32">
          {/* Section Divider */}
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