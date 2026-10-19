import { afterEach, describe, it, expect, vi } from 'vitest';
import { analysisWindows, fetchAnalysisMetrics, generateAnalysisAdvice } from './api/_lib/shift-analysis-service';
import { buildShiftAnalysis } from './shiftAnalysis';
afterEach(() => {vi.unstubAllGlobals(); vi.unstubAllEnvs();});
describe('analysis windows in Kyiv', () => {
  it('compares only elapsed current shift time', () => {
    const r = analysisWindows('current', new Date('2026-10-19T12:30:00Z'));
    expect(r.window.start).toBe('2026-10-19T11:00:00.000Z'); expect(r.window.end).toBe('2026-10-19T12:30:00.000Z');
    expect(r.baselineWindow.start).toBe('2026-10-12T11:00:00.000Z'); expect(r.baselineWindow.end).toBe('2026-10-12T12:30:00.000Z');
  });
  it('anchors midnight to the previous calendar date', () => {
    const r = analysisWindows('current', new Date('2026-10-18T22:00:00Z'));
    expect(r.window.start).toBe('2026-10-18T17:00:00.000Z');
    const p = analysisWindows('previous', new Date('2026-10-18T22:00:00Z'));
    expect(p.window.start).toBe('2026-10-18T11:00:00.000Z'); expect(p.window.end).toBe('2026-10-18T17:00:00.000Z');
  });
  it('handles seven-hour fall and five-hour spring shifts', () => {
    const fall = analysisWindows('previous', new Date('2026-10-25T07:00:00Z'));
    expect(fall.window.start).toBe('2026-10-24T23:00:00.000Z'); expect(fall.window.end).toBe('2026-10-25T06:00:00.000Z');
    const spring = analysisWindows('previous', new Date('2026-03-29T06:00:00Z'));
    expect(spring.window.start).toBe('2026-03-29T00:00:00.000Z'); expect(spring.window.end).toBe('2026-03-29T05:00:00.000Z');
  });
  it('last 24 hours means exactly 24 hours across DST', () => {
    const {window, baselineWindow} = analysisWindows('day', new Date('2026-10-25T12:00:00Z'));
    for (const r of [window, baselineWindow]) expect(Date.parse(r.end)-Date.parse(r.start)).toBe(86400000);
  });
});
describe('provider completeness', () => {
  const window = {start: '2026-10-19T11:00:00Z', end: '2026-10-19T12:00:00Z', label: 'test'};
  it('keeps partial rows but blocks conclusions after a later page fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({items: Array.from({length:100}, (_,i)=>({user_id: i}))}))).mockResolvedValueOnce(new Response('', {status:429})); vi.stubGlobal('fetch', fetcher);
    const result = await fetchAnalysisMetrics(window, 'test'); expect(result.rows).toHaveLength(100); expect(result.partial).toBe(true); expect(result.error).toContain('429');
    expect(fetcher.mock.calls[1][0]).toContain('offset=100');
  });
  it('rejects unexpected response schemas instead of treating them as zero', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"unknown":[]}')));
    expect((await fetchAnalysisMetrics(window, 'test')).partial).toBe(true);
  });
  it('recognizes a genuinely empty response as complete but unknown activity', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"items":[]}')));
    expect(await fetchAnalysisMetrics(window, 'test')).toEqual({rows: [], partial: false});
  });
});
describe('AI grounding', () => {
  const report = buildShiftAnalysis([], [], {id:'test',generatedAt:new Date().toISOString(),period:'current',window:{start:'',end:'',label:''},baselineWindow:{start:'',end:'',label:''},partial:false,quality:[]});
  it('does not call AI without evidence or on partial reports', async () => {
    vi.stubEnv('OPENAI_API_KEY','synthetic'); const fetcher = vi.fn(); vi.stubGlobal('fetch',fetcher);
    await expect(generateAnalysisAdvice(report)).rejects.toThrow('полные данные'); expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects invented finding IDs', async () => {
    vi.stubEnv('OPENAI_API_KEY','synthetic');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({summary:'test',actions:[{findingId:'invented'}]})}]}]}))));
    await expect(generateAnalysisAdvice({...report,findings:[{id:'valid', models: []} as any]})).rejects.toThrow('неподтверждённый');
  });
});
