import { randomUUID } from 'node:crypto';
import { requireSession, json } from '../_lib/auth.js';
import { getSupabaseClient } from '../_lib/supabase.js';
import { loadShiftAnalysis, generateAnalysisAdvice } from '../_lib/shift-analysis-service.js';
import type { AnalysisPeriod, ShiftAnalysis } from '../../shiftAnalysis.js';

const CACHE = 'om_shift_analysis_cache', JOURNAL = 'om_shift_experiments';
const validPeriods = new Set(['current', 'previous', 'day']);
const cleanText = (v: unknown, max: number, required = true) => {
  if (typeof v !== 'string' || v.trim().length > max || (required && !v.trim())) throw new Error('Проверьте заполнение и длину полей');
  return v.trim();
};
export default async function handler(req: any, res: any) {
  const actor = await requireSession(req, res, false); if (!actor) return;
  const query = req.query || Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
  const action = query.action || 'report', method = req.method || 'GET';
  if (!['GET', 'POST', 'PATCH'].includes(method)) return json(res, 405, { error: 'Method not allowed' });
  try {
    if (method === 'GET' && action === 'report') {
      const period = String(query.period || 'current'); if (!validPeriods.has(period)) return json(res, 400, { error: 'Неизвестный период' });
      const report = await loadShiftAnalysis(period as AnalysisPeriod);
      const db = await getSupabaseClient(); let journalReady = false;
      if (db) {
        const { error } = await db.from(CACHE).upsert({ id: report.id, kind: 'report', payload: report }, { onConflict: 'id', ignoreDuplicates: true });
        const { error: journalError } = await db.from(JOURNAL).select('id').limit(1);
        journalReady = !error && !journalError;
      }
      return json(res, 200, { report, journalReady, aiConfigured: Boolean(process.env.OPENAI_API_KEY) });
    }
    const db = await getSupabaseClient(); if (!db) return json(res, 503, { error: 'Хранилище анализа ещё не подключено' });
    if (method === 'GET' && action === 'experiments') {
      const { data, error } = await db.from(JOURNAL).select('*').order('created_at', { ascending: false }).limit(100);
      if (error) return json(res, 503, { error: 'Журнал экспериментов ещё не подключён' });
      return json(res, 200, { experiments: data });
    }
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json(res, 400, { error: 'Некорректный запрос' });
    if (method === 'POST' && action === 'ai') {
      const reportId = cleanText(body.reportId, 64);
      const { data: stored, error } = await db.from(CACHE).select('payload,created_at').eq('id', reportId).eq('kind', 'report').maybeSingle();
      if (error || !stored) return json(res, 404, { error: 'Обновите разбор перед запросом AI' });
      const report = stored.payload as ShiftAnalysis;
      if (Date.now() - Date.parse(report.generatedAt) > 10 * 60000) return json(res, 409, { error: 'Снимок устарел. Сначала обновите показатели' });
      if (!process.env.OPENAI_API_KEY) return json(res, 503, { error: 'AI ещё не подключён на сервере' });
      if (report.partial || !report.findings.length) return json(res, 422, { error: 'Недостаточно полных данных для рекомендаций AI' });
      const aiId = `ai:${reportId}`;
      const { data: cached } = await db.from(CACHE).select('payload').eq('id', aiId).eq('kind', 'ai').maybeSingle();
      if (cached) return json(res, 200, { advice: cached.payload, reportId });
      // A unique, durable budget slot prevents duplicate charges across instances/admins.
      const { error: locked } = await db.from(CACHE).insert({ id: `budget:${report.period}:${Math.floor(Date.now() / 900000)}`, kind: 'budget', payload: { reportId, actor: actor.id } });
      if (locked) return json(res, locked.code === '23505' ? 429 : 503, { error: locked.code === '23505' ? 'AI-разбор этого периода уже запускался. Следующий доступен в следующем 15-минутном интервале; расчёты можно обновлять сейчас.' : 'Не удалось зарезервировать AI-разбор' });
      const advice = await generateAnalysisAdvice(report);
      const { error: saved } = await db.from(CACHE).insert({ id: aiId, kind: 'ai', payload: advice });
      if (saved) return json(res, 503, { error: 'Не удалось сохранить AI-разбор. Повторное списание автоматически не выполняется.' });
      return json(res, 200, { advice, reportId });
    }
    if (method === 'POST' && action === 'experiments') {
      const reportId = cleanText(body.reportId, 64);
      const { data: stored } = await db.from(CACHE).select('payload').eq('id', reportId).eq('kind', 'report').maybeSingle();
      if (!stored) return json(res, 409, { error: 'Обновите разбор, затем сохраните эксперимент' });
      const operatorId = cleanText(body.operatorId, 100);
      const report = stored.payload as ShiftAnalysis, op = report.operators.find(o => o.id === operatorId);
      if (!op) return json(res, 400, { error: 'Оператор отсутствует в выбранном разборе' });
      const sourceUrl = cleanText(body.sourceUrl || '', 1000, false);
      if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) return json(res, 400, { error: 'Укажите ссылку http или https' });
      const record = { id: randomUUID(), created_by: actor.id, updated_by: actor.id, operator_id: operatorId,
        title: cleanText(body.title, 180), hypothesis: cleanText(body.hypothesis, 2000), plan: cleanText(body.plan, 2000),
        success_metric: cleanText(body.successMetric, 1000), stop_condition: cleanText(body.stopCondition, 1000),
        source_url: sourceUrl, source_note: cleanText(body.sourceNote || '', 1500, false), status: 'planned',
        baseline: { reportId, generatedAt: report.generatedAt, window: report.window, operator: op },
      };
      const { data, error } = await db.from(JOURNAL).insert(record).select().single();
      if (error) return json(res, 503, { error: 'Эксперимент не сохранён. Попробуйте позже' });
      return json(res, 201, { experiment: data });
    }
    if (method === 'PATCH' && action === 'experiments') {
      const id = cleanText(body.id, 36), revision = body.revision;
      if (!Number.isInteger(revision) || revision < 1 || !['active', 'completed', 'stopped'].includes(body.status)) return json(res, 400, { error: 'Некорректное состояние эксперимента' });
      const result = cleanText(body.result || '', 3000, body.status !== 'active');
      const outcome = body.status === 'completed' ? cleanText(body.outcome, 30) : 'pending';
      if (!(body.status === 'completed' ? ['promising', 'no_improvement', 'inconclusive'] : ['pending']).includes(outcome)) return json(res, 400, { error: 'Выберите результат проверки' });
      const { data: existing, error: readError } = await db.from(JOURNAL).select('status').eq('id', id).eq('revision', revision).maybeSingle();
      if (readError || !existing) return json(res, 409, { error: 'Запись изменена другим админом. Обновите журнал' });
      if (!(existing.status === 'planned' && ['active', 'stopped'].includes(body.status)) && !(existing.status === 'active' && ['completed', 'stopped'].includes(body.status))) return json(res, 409, { error: 'Этот переход состояния недоступен' });
      const timestamp = new Date().toISOString();
      const { data, error } = await db.from(JOURNAL).update({ status: body.status, result, outcome, revision: revision + 1, updated_at: timestamp, updated_by: actor.id, ...(body.status === 'active' ? { started_at: timestamp } : { completed_at: timestamp }) }).eq('id', id).eq('revision', revision).select().maybeSingle();
      if (error) return json(res, 503, { error: 'Изменения не сохранены' });
      if (!data) return json(res, 409, { error: 'Запись изменена другим админом. Обновите журнал' });
      return json(res, 200, { experiment: data });
    }
    return json(res, 405, { error: 'Недоступное действие' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось выполнить запрос';
    return json(res, message.startsWith('Проверьте') ? 400 : 503, { error: message });
  }
}
