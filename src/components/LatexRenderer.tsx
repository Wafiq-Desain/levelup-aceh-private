
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
        katex.render(content, containerRef.current, {
          throwOnError: false,
          displayMode: !inline,
        });
      } catch (error) {
        console.error("KaTeX rendering error:", error);
      }
    }
  }, [content, inline]);

  return <div ref={containerRef} className={inline ? "inline-block" : "my-2"} />;
};
