
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

const LessonTextTab: React.FC<LessonTextTabProps> = ({ content }) => {
  // Parse the raw markdown content into a structured object for navigation and rendering
  const sections = useMemo(() => {
    const parsed: Section[] = [];
    // Split by main headers (# 1. Read)
    const mainParts = content.split(/^# /m).filter(p => p.trim());

    mainParts.forEach((part, index) => {
      const lines = part.split('\n');
      const title = lines[0].trim();
      const sectionId = `section-${index}`;
      
      // Split the remainder of the section by sub-headers (## Bible Text)
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

  // Helper to render text with Drop-Cap for Bible verses/chapters
  const renderFormattedContent = (text: string) => {
    return text.split('\n\n').map((paragraph, pIdx) => {
      // Check if paragraph starts with a chapter/verse number (e.g. "1 In the beginning")
      const dropCapMatch = paragraph.match(/^(\d+)\s(.*)/);
      
      if (dropCapMatch) {
        const [, number, rest] = dropCapMatch;
        return (
          <p key={pIdx} className="mb-6 leading-relaxed text-gray-800 relative">
            <span className="float-left text-6xl font-bold text-[#9D1F4D] mr-3 mt-1 leading-[0.8] font-serif">
              {number}
            </span>
            {rest}
          </p>
        );
      }
      
      return (
        <p key={pIdx} className="mb-6 leading-relaxed text-gray-800">
          {paragraph}
        </p>
      );
    });
  };

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100; // Account for sticky header
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
      {/* LEFT COLUMN: TABLE OF CONTENTS (INTERNAL NAV) */}
      <aside className="w-full md:w-64 shrink-0">
        <div className="sticky top-32 space-y-8">
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">
              Lesson Pathway
            </h4>
            <nav className="space-y-1">
              {sections.map((section) => (
                <div key={section.id} className="space-y-1 mb-4">
                  <button
                    onClick={() => scrollTo(section.id)}
                    className="block w-full text-left text-xs font-black uppercase tracking-wider text-[#003882] hover:text-[#9D1F4D] transition-colors py-1"
                  >
                    {section.title}
                  </button>
                  <div className="pl-3 border-l-2 border-gray-100 space-y-1">
                    {section.subsections.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => scrollTo(sub.id)}
                        className="block w-full text-left text-[11px] font-medium text-gray-400 hover:text-[#9D1F4D] transition-colors py-0.5 truncate"
                      >
                        {sub.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
          
          <div className="hidden md:block p-6 bg-gray-50 rounded-3xl border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
              Tip: Use the sidebar to jump between reading and teaching phases.
            </p>
          </div>
        </div>
      </aside>

      {/* RIGHT COLUMN: READING VIEW */}
      <div className="flex-1 max-w-2xl font-serif">
        {sections.map((section) => (
          <div key={section.id} id={section.id} className="mb-16">
            <h2 className="text-sm font-black uppercase tracking-[0.3em] text-[#9D1F4D] mb-10 pb-4 border-b border-gray-100">
              {section.title}
            </h2>
            
            <div className="space-y-12">
              {section.subsections.map((sub) => (
                <section key={sub.id} id={sub.id} className="scroll-mt-32">
                  <h3 className="text-xl font-bold text-gray-900 mb-6 font-sans">
                    {sub.title}
                  </h3>
                  <div className="text-lg md:text-xl text-gray-800 selection:bg-pink-100">
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
