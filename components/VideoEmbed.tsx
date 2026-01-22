
import React from 'react';

interface VideoEmbedProps {
  url: string;
  title?: string;
}

const VideoEmbed: React.FC<VideoEmbedProps> = ({ url, title }) => {
  const getEmbedUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
        const videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
        return `https://www.youtube.com/embed/${videoId}`;
      }
      if (urlObj.hostname.includes('vimeo.com')) {
        const videoId = urlObj.pathname.split('/').pop();
        return `https://player.vimeo.com/video/${videoId}`;
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  const embedUrl = getEmbedUrl(url);

  if (!embedUrl) {
    return (
      <div className="bg-gray-100 p-8 rounded-lg text-center border-2 border-dashed border-gray-300">
        <p className="text-gray-600 mb-2">Video cannot be embedded automatically.</p>
        <p className="text-sm font-medium">Admin: Please upload a compatible video file or use a YouTube/Vimeo link.</p>
      </div>
    );
  }

  return (
    <div className="relative pt-[56.25%] w-full bg-black rounded-lg overflow-hidden shadow-lg">
      <iframe
        className="absolute top-0 left-0 w-full h-full"
        src={embedUrl}
        title={title || "Lesson Video"}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

export default VideoEmbed;
