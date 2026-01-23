
import React, { useMemo } from 'react';

interface SubSection {
  id: string;
  title: string;
  content: string;
}

interface Section {
  id: string;
  title: string;
  subsections: SubSection[];
}

interface LessonTextTabProps {
  content: string;
}

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

const LessonTextTab: React.FC<LessonTextTabProps> = ({ content }) => {
  const sections = useMemo(() => {
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
  }, [content]);

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

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 120;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-12 relative animate-in fade-in slide-in-from-bottom-4 duration-500">
      <aside className="w-full md:w-64 shrink-0">
        <div className="sticky top-32 space-y-8">
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Lesson Pathway</h4>
            <nav className="space-y-1">
              {sections.map((section) => (
                <div key={section.id} className="space-y-1 mb-4">
                  <button
                    onClick={() => scrollTo(section.id)}
                    className="block w-full text-left text-[11px] font-black uppercase tracking-wider text-[#EF4E92] hover:text-black transition-colors py-1"
                  >
                    {section.title}
                  </button>
                  <div className="pl-3 border-l-2 border-gray-100 space-y-1">
                    {section.subsections.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => scrollTo(sub.id)}
                        className="block w-full text-left text-[11px] font-medium text-gray-400 hover:text-[#EF4E92] transition-colors py-0.5 truncate"
                      >
                        {sub.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
          <div className="hidden md:block p-6 bg-gray-50 rounded-[32px] border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
              Tip: Review each card thoroughly before teaching.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex-1 max-w-3xl">
        {sections.map((section) => (
          <div key={section.id} id={section.id} className="mb-12">
            {/* Section Divider */}
            <div className="flex items-center gap-6 mb-10">
               <h2 className="shrink-0 text-sm font-black uppercase tracking-[0.3em] text-[#EF4E92]">
                {section.title}
              </h2>
              <div className="flex-1 h-px bg-gray-100"></div>
            </div>
            
            <div className="space-y-6">
              {section.subsections.map((sub) => (
                <section 
                  key={sub.id} 
                  id={sub.id} 
                  className="bg-white rounded-[40px] p-8 md:p-10 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group scroll-mt-32"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-pink-50 text-[#EF4E92] flex items-center justify-center transition-colors group-hover:bg-[#EF4E92] group-hover:text-white">
                      {getIcon(sub.title)}
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                      {sub.title}
                    </h3>
                  </div>
                  <div className="text-lg md:text-xl font-serif text-gray-800 leading-relaxed selection:bg-pink-100">
                    {renderFormattedContent(sub.content)}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LessonTextTab;
