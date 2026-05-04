
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
        // Membersihkan konten sebelum render untuk mencegah duplikasi
        containerRef.current.innerHTML = "";
        
        // Memeriksa apakah konten mengandung penanda math $...$
        // Jika tidak, kita bisa merender seluruh konten sebagai math atau teks biasa
        // Di sini kita asumsikan jika mengandung $, kita gunakan render standar
        // Untuk kesederhanaan sesuai permintaan sebelumnya, kita render seluruhnya
        katex.render(content, containerRef.current, {
          throwOnError: false,
          displayMode: !inline,
          output: "html",
        });
      } catch (error) {
        console.error("KaTeX rendering error:", error);
        if (containerRef.current) {
          containerRef.current.textContent = content;
        }
      }
    }
  }, [content, inline]);

  // Menggunakan span untuk inline agar tidak merusak aliran teks
  return inline ? (
    <span ref={containerRef as any} className="inline-block mx-1" />
  ) : (
    <div ref={containerRef} className="my-2 overflow-x-auto" />
  );
};
