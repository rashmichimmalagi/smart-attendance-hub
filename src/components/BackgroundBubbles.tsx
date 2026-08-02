/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface Bubble {
  id: number;
  size: string;
  left: string;
  delay: string;
  duration: string;
  animationClass: string;
  colorClass: string;
}

const BUBBLES: Bubble[] = [
  {
    id: 1,
    size: 'w-24 h-24 sm:w-28 sm:h-28',
    left: '5%',
    delay: '0s',
    duration: '22s',
    animationClass: 'animate-float-1',
    colorClass: 'border-cyan-500/10 bg-cyan-500/5 shadow-[0_0_20px_rgba(6,182,212,0.1)]',
  },
  {
    id: 2,
    size: 'w-32 h-32 sm:w-36 sm:h-36',
    left: '18%',
    delay: '4s',
    duration: '28s',
    animationClass: 'animate-float-2',
    colorClass: 'border-purple-500/10 bg-purple-500/5 shadow-[0_0_20px_rgba(139,92,246,0.1)]',
  },
  {
    id: 3,
    size: 'w-16 h-16 sm:w-20 sm:h-20',
    left: '32%',
    delay: '2s',
    duration: '18s',
    animationClass: 'animate-float-3',
    colorClass: 'border-emerald-500/10 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]',
  },
  {
    id: 4,
    size: 'w-40 h-40 sm:w-48 sm:h-48',
    left: '45%',
    delay: '7s',
    duration: '35s',
    animationClass: 'animate-float-4',
    colorClass: 'border-rose-500/10 bg-rose-500/5 shadow-[0_0_20px_rgba(244,63,94,0.1)]',
  },
  {
    id: 5,
    size: 'w-20 h-20 sm:w-24 sm:h-24',
    left: '60%',
    delay: '1s',
    duration: '25s',
    animationClass: 'animate-float-1',
    colorClass: 'border-cyan-500/10 bg-cyan-500/5 shadow-[0_0_20px_rgba(6,182,212,0.1)]',
  },
  {
    id: 6,
    size: 'w-36 h-36 sm:w-44 sm:h-44',
    left: '75%',
    delay: '10s',
    duration: '32s',
    animationClass: 'animate-float-2',
    colorClass: 'border-purple-500/10 bg-purple-500/5 shadow-[0_0_20px_rgba(139,92,246,0.1)]',
  },
  {
    id: 7,
    size: 'w-24 h-24 sm:w-28 sm:h-28',
    left: '88%',
    delay: '5s',
    duration: '20s',
    animationClass: 'animate-float-3',
    colorClass: 'border-emerald-500/10 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]',
  },
  {
    id: 8,
    size: 'w-28 h-28 sm:w-32 sm:h-32',
    left: '12%',
    delay: '12s',
    duration: '30s',
    animationClass: 'animate-float-4',
    colorClass: 'border-rose-500/10 bg-rose-500/5 shadow-[0_0_20px_rgba(244,63,94,0.1)]',
  },
  {
    id: 9,
    size: 'w-20 h-20 sm:w-24 sm:h-24',
    left: '28%',
    delay: '8s',
    duration: '24s',
    animationClass: 'animate-float-1',
    colorClass: 'border-cyan-500/10 bg-cyan-500/5 shadow-[0_0_20px_rgba(6,182,212,0.1)]',
  },
  {
    id: 10,
    size: 'w-44 h-44 sm:w-56 sm:h-56',
    left: '52%',
    delay: '15s',
    duration: '40s',
    animationClass: 'animate-float-2',
    colorClass: 'border-purple-500/10 bg-purple-500/5 shadow-[0_0_20px_rgba(139,92,246,0.1)]',
  },
  {
    id: 11,
    size: 'w-16 h-16 sm:w-18 sm:h-18',
    left: '70%',
    delay: '3s',
    duration: '21s',
    animationClass: 'animate-float-3',
    colorClass: 'border-rose-500/10 bg-rose-500/5 shadow-[0_0_20px_rgba(244,63,94,0.1)]',
  },
  {
    id: 12,
    size: 'w-32 h-32 sm:w-36 sm:h-36',
    left: '82%',
    delay: '9s',
    duration: '27s',
    animationClass: 'animate-float-4',
    colorClass: 'border-emerald-500/10 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]',
  },
  {
    id: 13,
    size: 'w-24 h-24 sm:w-28 sm:h-28',
    left: '94%',
    delay: '14s',
    duration: '31s',
    animationClass: 'animate-float-1',
    colorClass: 'border-cyan-500/10 bg-cyan-500/5 shadow-[0_0_20px_rgba(6,182,212,0.1)]',
  },
  {
    id: 14,
    size: 'w-18 h-18 sm:w-22 sm:h-22',
    left: '2%',
    delay: '11s',
    duration: '26s',
    animationClass: 'animate-float-2',
    colorClass: 'border-purple-500/10 bg-purple-500/5 shadow-[0_0_20px_rgba(139,92,246,0.1)]',
  },
  {
    id: 15,
    size: 'w-30 h-30 sm:w-34 sm:h-34',
    left: '23%',
    delay: '16s',
    duration: '33s',
    animationClass: 'animate-float-3',
    colorClass: 'border-cyan-500/10 bg-cyan-500/5 shadow-[0_0_20px_rgba(6,182,212,0.1)]',
  },
  {
    id: 16,
    size: 'w-22 h-22 sm:w-26 sm:h-26',
    left: '40%',
    delay: '13s',
    duration: '29s',
    animationClass: 'animate-float-4',
    colorClass: 'border-emerald-500/10 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]',
  },
  {
    id: 17,
    size: 'w-36 h-36 sm:w-40 sm:h-40',
    left: '65%',
    delay: '18s',
    duration: '34s',
    animationClass: 'animate-float-1',
    colorClass: 'border-rose-500/10 bg-rose-500/5 shadow-[0_0_20px_rgba(244,63,94,0.1)]',
  },
  {
    id: 18,
    size: 'w-20 h-20 sm:w-24 sm:h-24',
    left: '78%',
    delay: '20s',
    duration: '23s',
    animationClass: 'animate-float-2',
    colorClass: 'border-cyan-500/10 bg-cyan-500/5 shadow-[0_0_20px_rgba(6,182,212,0.1)]',
  },
  {
    id: 19,
    size: 'w-26 h-26 sm:w-30 sm:h-30',
    left: '85%',
    delay: '22s',
    duration: '31s',
    animationClass: 'animate-float-3',
    colorClass: 'border-purple-500/10 bg-purple-500/5 shadow-[0_0_20px_rgba(139,92,246,0.1)]',
  },
  {
    id: 20,
    size: 'w-16 h-16 sm:w-18 sm:h-18',
    left: '92%',
    delay: '25s',
    duration: '25s',
    animationClass: 'animate-float-4',
    colorClass: 'border-rose-500/10 bg-rose-500/5 shadow-[0_0_20px_rgba(244,63,94,0.1)]',
  },
];

export default function BackgroundBubbles() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {BUBBLES.map((bubble) => (
        <div
          key={bubble.id}
          className={`absolute rounded-full border backdrop-blur-[2px] transition-all ${bubble.size} ${bubble.colorClass} ${bubble.animationClass}`}
          style={{
            left: bubble.left,
            animationDelay: bubble.delay,
            animationDuration: bubble.duration,
            bottom: '-150px',
          }}
        />
      ))}
    </div>
  );
}
