
"use client";

import React, { useMemo } from "react";
import katex from "katex";

interface LatexRendererProps {
  content: string;
  inline?: boolean;
}

/**
 * LatexRenderer yang lebih cerdas:
 * Memisahkan antara teks biasa dan rumus matematika (diapit $...$ atau $$...$$)
 * agar spasi pada teks biasa tidak hilang dan teks bisa membungkus (wrap) dengan benar.
 */
export const LatexRenderer: React.FC<LatexRendererProps> = ({ content, inline = false }) => {
  const renderedContent = useMemo(() => {
    if (!content) return null;

    // Split konten berdasarkan delimiter $...$ atau $$...$$
    const parts = content.split(/(\$\$.*?\$\$|\$.*?\$)/g);

    return parts.map((part, index) => {
      // Cek apakah bagian ini adalah display math ($$ ... $$)
      if (part.startsWith("$$") && part.endsWith("$$")) {
        const math = part.slice(2, -2);
        try {
          const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
          return (
            <div 
              key={index} 
              className="my-3 overflow-x-auto overflow-y-hidden py-1" 
              dangerouslySetInnerHTML={{ __html: html }} 
            />
          );
        } catch (e) {
          return <code key={index}>{part}</code>;
        }
      } 
      // Cek apakah bagian ini adalah inline math ($ ... $)
      else if (part.startsWith("$") && part.endsWith("$")) {
        const math = part.slice(1, -1);
        try {
          const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
          return (
            <span 
              key={index} 
              className="inline-block px-0.5" 
              dangerouslySetInnerHTML={{ __html: html }} 
            />
          );
        } catch (e) {
          return <code key={index}>{part}</code>;
        }
      } 
      // Jika teks biasa
      else {
        return (
          <span key={index} className="whitespace-pre-wrap break-words">
            {part}
          </span>
        );
      }
    });
  }, [content]);

  return (
    <div className={inline ? "inline" : "block w-full max-w-full overflow-hidden text-wrap break-words"}>
      {renderedContent}
    </div>
  );
};
