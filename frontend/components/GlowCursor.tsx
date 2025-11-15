'use client';
import { useEffect } from 'react';

export default function GlowCursor() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.body.classList.add('cursor-neon');

    const el = document.createElement('div');
    el.className = 'glow-cursor';
    document.body.appendChild(el);

    let raf = 0;
    const move = (e: MouseEvent) => {
      const x = e.clientX, y = e.clientY;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    };

    window.addEventListener('mousemove', move);
    return () => {
      window.removeEventListener('mousemove', move);
      cancelAnimationFrame(raf);
      document.body.classList.remove('cursor-neon');
      el.remove();
    };
  }, []);

  return null;
}
