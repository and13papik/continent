import { describe, it, expect } from 'vitest';
import { aggregateAnalysis, buildShiftAnalysis, metricNumber, type RawMetric } from './shiftAnalysis';
const row = (extra: RawMetric = {}): RawMetric => ({ user_id: '1', creator_ids: ['model1'], messages_count: 100, paid_messages_count: 40, sold_messages_count: 10, sold_messages_price_sum: 100, sold_posts_price_sum: 0, tips_amount_sum: 25, reply_time_avg: 60, ...extra });
const meta = { id: 'test', generatedAt: '2026-10-19T12:00:00Z', period: 'current' as const, window: {start: '', end: '', label: ''}, baselineWindow: {start: '', end: '', label: ''}, partial: false, quality: [] };
describe('shift analysis evidence', () => {
  it.each([null, undefined, '', ' ', false, {}, [], -1, Infinity, 'wrong'])('does not coerce unavailable metric %j to zero', input => expect(metricNumber(input)).toBeNull());
  it('retains genuine zeros and numeric provider strings', () => { expect(metricNumber(0)).toBe(0); expect(metricNumber('2.5')).toBe(2.5); });
  it('calculates revenue, average PPV and event ratio independently', () => {
    expect(aggregateAnalysis([row()])).toMatchObject({net: 100, netPer100: 100, ppvAverage: 10, soldSentRatio: 25, tipsShare: 20});
    expect(aggregateAnalysis([row({tips_amount_sum: undefined})])).toMatchObject({net: null, ppvAverage: 10, netPer100: null});
  });
  it('does not hide missing fields in multi-row totals or empty periods', () => {
    expect(aggregateAnalysis([row(), row({messages_count: null})]).messages_count).toBeNull();
    expect(Object.values(aggregateAnalysis([])).every(x => x === null)).toBe(true);
  });
  it('requires real sample weights to combine response averages', () => {
    expect(aggregateAnalysis([row(), row({reply_time_avg: 180})]).replySeconds).toBeNull();
    expect(aggregateAnalysis([row({reply_time_count: 3}), row({reply_time_avg: 180, reply_time_count: 1})]).replySeconds).toBe(90);
  });
  it('does not clamp lagged purchase ratios or label them conversion signals', () => {
    const r = buildShiftAnalysis([row({sold_messages_count: 60})], [row()], meta);
    expect(r.totals.soldSentRatio).toBe(150);
    expect(r.findings.some(f => f.metric === 'soldSentRatio')).toBe(false);
  });
  it('detects evidence-backed negative and positive signals', () => {
    const r = buildShiftAnalysis([row({sold_messages_price_sum: 40, tips_amount_sum: 0, reply_time_avg: 20})], [row()], meta);
    expect(r.findings).toEqual(expect.arrayContaining([expect.objectContaining({metric: 'netPer100', kind: 'attention', current: 32, baseline: 100}), expect.objectContaining({metric: 'replySeconds', kind: 'positive'})]));
  });
  it.each([{partial: true}, {quality: []}])('disables unreliable comparisons where appropriate', extra => {
    const r = buildShiftAnalysis([row({creator_ids: ['other'], sold_messages_price_sum: 20})], [row()], {...meta, ...extra});
    expect(r.findings).toHaveLength(0); expect(r.operators[0].comparable).toBe(false);
  });
  it('blocks all comparative conclusions and peer cases on partial imports', () => {
    const r = buildShiftAnalysis([row(), row({user_id: '2', sold_messages_price_sum: 500})], [row()], {...meta, partial: true});
    expect(r.findings).toHaveLength(0); expect(r.cases).toHaveLength(0);
  });
  it('requires sufficient samples and never treats missing history as zero performance', () => {
    expect(buildShiftAnalysis([row({messages_count: 10})], [row()], meta).findings).toHaveLength(0);
    expect(buildShiftAnalysis([row()], [], meta).operators[0].baseline).toBeNull();
  });
  it('peer examples require the same single model and enough sales', () => {
    const r = buildShiftAnalysis([row(), row({user_id: '2', sold_messages_price_sum: 300}), row({user_id: '3', creator_ids: ['other'], sold_messages_price_sum: 900})], [], meta);
    expect(r.cases).toHaveLength(1); expect(r.cases[0]).toMatchObject({from: '2', to: '1'});
  });
});
