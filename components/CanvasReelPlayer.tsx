'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReelPlan } from '@/lib/agent';

export type CanvasReelPlayerHandle = {
  play: () => void;
  stop: () => void;
  recordFullPlayback: () => Promise<Blob>;
};

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const test = current ? current + ' ' + w : w;
    const wWidth = ctx.measureText(test).width;
    if (wWidth > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const FULL_W = 1080;
const FULL_H = 1920;

const CanvasReelPlayer = forwardRef<CanvasReelPlayerHandle, { plan: ReelPlan | null; width: number; height: number }>(
  ({ plan, width, height }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const startTimeRef = useRef<number>(0);
    const rafRef = useRef<number | null>(null);

    const totalDuration = plan?.beats.reduce((a, b) => a + b.durationMs, 0) ?? 0;

    const drawFrame = (elapsed: number) => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;

      // scale to full size offscreen
      ctx.clearRect(0, 0, c.width, c.height);

      // background gradient
      const g = ctx.createLinearGradient(0, 0, c.width, c.height);
      g.addColorStop(0, '#0ea5e9');
      g.addColorStop(1, '#111827');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, c.height);

      // Determine current beat
      let t = elapsed;
      let beatIndex = 0;
      let beatStart = 0;
      for (let i = 0; i < (plan?.beats.length ?? 0); i++) {
        const d = plan!.beats[i].durationMs;
        if (t < d) { beatIndex = i; break; }
        t -= d; beatStart += d;
      }
      const beat = plan?.beats[beatIndex];
      const progress = beat ? Math.min(1, Math.max(0, t / beat.durationMs)) : 0;

      // vignette
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, c.width, c.height);

      // header/branding
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 56px Inter, ui-sans-serif';
      const title = plan?.title || 'Reel';
      ctx.fillText(title, 64, 120);

      // progress bar
      const p = totalDuration > 0 ? (elapsed / totalDuration) : 0;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(64, 140, c.width - 128, 8);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(64, 140, (c.width - 128) * Math.max(0, Math.min(1, p)), 8);

      // main text for beat
      if (beat) {
        const display = beat.text;
        ctx.font = '900 84px Inter, ui-sans-serif';
        ctx.fillStyle = 'white';
        ctx.textBaseline = 'top';
        const maxWidth = c.width - 128;
        const lines = wrapText(ctx, display, maxWidth);
        const lineH = 88;
        const totalH = lines.length * lineH;
        const baseY = c.height / 2 - totalH / 2;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const eased = easeInOutCubic(Math.min(1, progress * 1.2));
          const y = baseY + i * lineH + (1 - eased) * 40;
          ctx.globalAlpha = 0.2 + 0.8 * eased;
          ctx.fillText(line, 64, y);
          ctx.globalAlpha = 1;
        }
      }

      // CTA footer
      ctx.font = '600 48px Inter, ui-sans-serif';
      ctx.fillStyle = '#d1fae5';
      const cta = plan?.cta || '';
      const metrics = ctx.measureText(cta);
      ctx.fillText(cta, (c.width - metrics.width) / 2, c.height - 160);

      // hashtag strip
      const tags = plan?.hashtags?.slice(0, 3).join(' ') ?? '';
      ctx.font = '500 36px Inter, ui-sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(tags, 64, c.height - 100);
    };

    const tick = (now: number) => {
      if (!isPlaying || !startTimeRef.current) return;
      const elapsed = now - startTimeRef.current;
      if (elapsed >= totalDuration) {
        drawFrame(totalDuration);
        setIsPlaying(false);
        startTimeRef.current = 0;
        return;
      }
      drawFrame(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };

    const play = () => {
      if (!plan || isPlaying) return;
      setIsPlaying(true);
      startTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    };

    const stop = () => {
      setIsPlaying(false);
      startTimeRef.current = 0;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      drawFrame(0);
    };

    const recordFullPlayback = async (): Promise<Blob> => {
      if (!plan) throw new Error('No plan');
      // Ensure canvas at full resolution for recording
      const canvas = canvasRef.current!;
      // Temporarily render at full size
      const prevW = canvas.width, prevH = canvas.height, prevStyle = { width: canvas.style.width, height: canvas.style.height };
      canvas.width = FULL_W;
      canvas.height = FULL_H;
      canvas.style.width = FULL_W + 'px';
      canvas.style.height = FULL_H + 'px';

      // Start recording
      const stream = canvas.captureStream(30);
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      });

      recorder.start();
      // Playback at full size
      setIsPlaying(true);
      startTimeRef.current = performance.now();
      const loop = (now: number) => {
        if (!isPlaying) return; // early stop
        const elapsed = now - startTimeRef.current;
        if (elapsed >= totalDuration) {
          drawFrame(totalDuration);
          setIsPlaying(false);
          recorder.stop();
          return;
        }
        drawFrame(elapsed);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      const blob = await done;

      // restore canvas size for UI
      canvas.width = Math.floor(FULL_W * (width / FULL_W));
      canvas.height = Math.floor(FULL_H * (height / FULL_H));
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      drawFrame(0);

      return blob;
    };

    useImperativeHandle(ref, () => ({ play, stop, recordFullPlayback }), [plan, isPlaying, totalDuration]);

    useEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      // scale internal resolution to match displayed size for preview quality
      const scale = Math.min(FULL_W / width, FULL_H / height);
      c.width = Math.floor(width * scale);
      c.height = Math.floor(height * scale);
      c.style.width = width + 'px';
      c.style.height = height + 'px';
      drawFrame(0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width, height, plan]);

    useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

    return <canvas ref={canvasRef} style={{ width, height, borderRadius: 16, display: 'block', background: '#000', border: '1px solid rgba(255,255,255,0.1)' }} />;
  }
);

CanvasReelPlayer.displayName = 'CanvasReelPlayer';
export default CanvasReelPlayer;
