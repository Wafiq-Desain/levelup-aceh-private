
"use client";

import React, { useEffect, useRef } from "react";
import katex from "katex";

interface LatexRendererProps {
  content: string;
  inline?: boolean;
}

export const LatexRenderer: React.FC<LatexRendererProps> = ({ content, inline = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        // Membersihkan konten sebelum render untuk mencegah duplikasi teks (Common issue with KaTeX + React)
        containerRef.current.innerHTML = "";
        
        // Render konten menggunakan KaTeX
        katex.render(content, containerRef.current, {
          throwOnError: false,
          displayMode: !inline,
          output: "html",
          trust: true,
        });
      } catch (error) {
        // Jika gagal render KaTeX, tampilkan teks mentah agar konten tetap terbaca
        if (containerRef.current) {
          containerRef.current.textContent = content;
        }
      }
    }
  }, [content, inline]);

  // suppressHydrationWarning ditambahkan untuk mencegah error mismatch antara server dan klien
  return inline ? (
    <span ref={containerRef as any} className="inline-block mx-1" suppressHydrationWarning />
  ) : (
    <div ref={containerRef} className="my-2 overflow-x-auto" suppressHydrationWarning />
  );
};
