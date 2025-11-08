'use client';

import { useMemo, useRef, useState } from 'react';
import { generateReelPlan, ReelPlan, toSrt } from '@/lib/agent';
import CanvasReelPlayer, { CanvasReelPlayerHandle } from '@/components/CanvasReelPlayer';

function Input({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="card" style={{ display: 'block' }}>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

export default function Page() {
  const [topic, setTopic] = useState('How to grow on Instagram in 2025');
  const [audience, setAudience] = useState('Creators and small businesses');
  const [tone, setTone] = useState<'bold' | 'friendly' | 'educational' | 'funny'>('bold');
  const [duration, setDuration] = useState(24);
  const [plan, setPlan] = useState<ReelPlan | null>(null);
  const playerRef = useRef<CanvasReelPlayerHandle>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const totalMs = useMemo(() => (plan?.beats.reduce((a, b) => a + b.durationMs, 0) ?? 0), [plan]);

  const onGenerate = () => {
    const p = generateReelPlan({ topic, audience, tone, targetDurationSec: duration });
    setPlan(p);
    setRecordingUrl(null);
  };

  const onDownloadSrt = () => {
    if (!plan) return;
    const blob = new Blob([toSrt(plan)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (plan.title || 'captions') + '.srt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDownloadJson = () => {
    if (!plan) return;
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (plan.title || 'reel-plan') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onRecord = async () => {
    if (!plan || !playerRef.current) return;
    setIsRecording(true);
    setRecordingUrl(null);
    try {
      const blob = await playerRef.current.recordFullPlayback();
      const url = URL.createObjectURL(blob);
      setRecordingUrl(url);
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div className="container">
      <header className="header" style={{ marginBottom: 16 }}>
        <div className="badge">Reel Agent</div>
        <div style={{ color: '#9ca3af' }}>Generate, preview, and export short-form reels</div>
      </header>

      <div className="row" style={{ marginBottom: 16 }}>
        <div className="col-8">
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="label" style={{ marginBottom: 8 }}>Prompt</div>
            <div className="row">
              <div className="col-12">
                <Input label="Topic">
                  <input className="input" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., 5 hooks for e-commerce reels" />
                </Input>
              </div>
              <div className="col-6">
                <Input label="Audience">
                  <input className="input" value={audience} onChange={e => setAudience(e.target.value)} placeholder="e.g., busy founders" />
                </Input>
              </div>
              <div className="col-3">
                <Input label="Tone">
                  <select className="select" value={tone} onChange={e => setTone(e.target.value as any)}>
                    <option value="bold">Bold</option>
                    <option value="friendly">Friendly</option>
                    <option value="educational">Educational</option>
                    <option value="funny">Funny</option>
                  </select>
                </Input>
              </div>
              <div className="col-3">
                <Input label="Duration (sec)">
                  <input className="input" type="number" min={6} max={60} value={duration} onChange={e => setDuration(parseInt(e.target.value || '0'))} />
                </Input>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button className="button primary" onClick={onGenerate}>Generate Reel Plan</button>
              <button className="button secondary" disabled={!plan} onClick={() => playerRef.current?.play()}>Play</button>
              <button className="button" disabled={!plan} onClick={() => playerRef.current?.stop()}>Stop</button>
            </div>
          </div>

          <div className="card">
            <div className="label" style={{ marginBottom: 8 }}>Preview (1080x1920, 9:16)</div>
            <CanvasReelPlayer ref={playerRef} plan={plan} width={360} height={640} />
            <div className="kpi" style={{ marginTop: 8 }}>
              <div><span className="badge">Beats</span> <span className="num">{plan?.beats.length ?? 0}</span></div>
              <div><span className="badge">Captions</span> <span className="num">{plan?.captions.length ?? 0}</span></div>
              <div><span className="badge">Duration</span> <span className="num">{Math.round(totalMs/1000)}s</span></div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="button primary" disabled={!plan || isRecording} onClick={onRecord}>{isRecording ? 'Recording?' : 'Export to WebM'}</button>
              <button className="button" disabled={!plan} onClick={onDownloadSrt}>Download SRT</button>
              <button className="button" disabled={!plan} onClick={onDownloadJson}>Download JSON</button>
              {recordingUrl && (
                <a className="button secondary" href={recordingUrl} download={(plan?.title || 'reel') + '.webm'}>Download WebM</a>
              )}
            </div>
          </div>

          <div className="footer">No external APIs required. Rendering and recording happen locally in your browser.</div>
        </div>

        <div className="col-4">
          <div className="sidebar">
            <div className="card">
              <div className="label" style={{ marginBottom: 6 }}>Tips</div>
              <div className="helper">Use strong hooks, short sentences, and a bold CTA. Aim for 18?28 seconds for best completion rates.</div>
            </div>
            <div className="card">
              <div className="label" style={{ marginBottom: 6 }}>Plan</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#e5e7eb' }}>{plan ? JSON.stringify({ title: plan.title, hook: plan.hook, cta: plan.cta, hashtags: plan.hashtags }, null, 2) : '?'}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
