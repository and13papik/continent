// Pure calculations shared by the API, UI and tests. Missing data stays unknown.
export const analysisFields = {
  messages_count: ['Сообщения', 'count'], paid_messages_count: ['PPV отправлено', 'count'],
  sold_messages_count: ['PPV продано', 'count'], sold_messages_price_sum: ['Продажи PPV · GROSS', 'money'],
  sold_posts_price_sum: ['Продажи постов · GROSS', 'money'], tips_amount_sum: ['Чаевые · GROSS', 'money'],
  typed_messages_count: ['Ручные сообщения', 'count'], ai_generated_messages_count: ['AI-сообщения', 'count'],
  copied_messages_count: ['Скопированные', 'count'], template_messages_count: ['Шаблоны OF', 'count'],
  internal_templates_count: ['Внутренние шаблоны', 'count'], free_media_messages_count: ['Бесплатные медиа', 'count'],
  net: ['Продажи оператора · NET ≈', 'money'], ppvAverage: ['Средний проданный PPV · GROSS', 'money'],
  soldSentRatio: ['Продано / отправлено за период', 'percent'], netPer100: ['NET на 100 сообщений ≈', 'money'],
  tipsShare: ['Доля чаевых в продажах', 'percent'], replySeconds: ['Средний ответ', 'seconds'],
} as const;
export type MetricKey = keyof typeof analysisFields;
export type Metrics = Record<MetricKey, number | null>;
export type AnalysisPeriod = 'current' | 'previous' | 'day';
export type Window = { start: string; end: string; label: string };
export type Finding = { id: string; operatorId: string; models: string[]; kind: 'attention' | 'positive' | 'hypothesis'; title: string; metric: MetricKey; current: number; baseline: number; change: number; action: string; caveat: string };
export type AnalysisOperator = { id: string; name: string; models: string[]; current: Metrics; baseline: Metrics | null; comparable: boolean; findings: Finding[] };
export type ShiftAnalysis = { id: string; generatedAt: string; period: AnalysisPeriod; window: Window; baselineWindow: Window; partial: boolean; quality: string[]; totals: Metrics; operators: AnalysisOperator[]; findings: Finding[]; cases: { from: string; to: string; models: string[]; current: number; peer: number; action: string }[] };
export type RawMetric = Record<string, unknown>;
const rawKeys = Object.keys(analysisFields).slice(0, 12) as MetricKey[];
const aliases: Partial<Record<MetricKey, string[]>> = { messages_count: ['messages', 'sent_messages'], paid_messages_count: ['paid_messages'], sold_messages_count: ['sold_messages'] };
export function metricNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null;
}
function read(row: RawMetric, key: MetricKey) {
  for (const k of [key, ...(aliases[key] || [])]) if (row[k] !== undefined) return metricNumber(row[k]);
  return null;
}
function ratio(a: number | null, b: number | null, factor = 1) { return a !== null && b !== null && b > 0 ? Math.round(a / b * factor * 100) / 100 : null; }
export function aggregateAnalysis(rows: RawMetric[]): Metrics {
  const out = Object.fromEntries(Object.keys(analysisFields).map(k => [k, null])) as Metrics;
  if (!rows.length) return out;
  for (const k of rawKeys) {
    const vals = rows.map(r => read(r, k));
    out[k] = vals.every(v => v !== null) ? Math.round((vals as number[]).reduce((a, b) => a + b, 0) * 100) / 100 : null;
  }
  const amounts = [out.sold_messages_price_sum, out.sold_posts_price_sum, out.tips_amount_sum];
  const gross = amounts.every(n => n !== null) ? (amounts as number[]).reduce((a, b) => a + b, 0) : null;
  out.net = gross !== null ? Math.round(gross * 80) / 100 : null;
  out.ppvAverage = ratio(out.sold_messages_price_sum, out.sold_messages_count);
  out.soldSentRatio = ratio(out.sold_messages_count, out.paid_messages_count, 100);
  out.netPer100 = ratio(out.net, out.messages_count, 100);
  out.tipsShare = ratio(out.tips_amount_sum, gross, 100);
  // Never average averages without the provider's actual observation counts.
  const replies = rows.map(r => metricNumber(r.reply_time_avg ?? r.reply_time));
  if (rows.length === 1) out.replySeconds = replies[0];
  else {
    const weights = rows.map(r => metricNumber(r.reply_time_count));
    if (replies.every(v => v !== null) && weights.every(v => v !== null) && (weights as number[]).reduce((a, b) => a + b, 0) > 0)
      out.replySeconds = Math.round((replies as number[]).reduce((a, b, i) => a + b * weights[i]!, 0) / (weights as number[]).reduce((a, b) => a + b, 0));
  }
  return out;
}
export function rowModels(row: RawMetric): string[] {
  const vals = Array.isArray(row.creator_ids) ? row.creator_ids : [row.creator_id ?? row.account_id];
  return [...new Set(vals.filter(v => typeof v === 'string' || typeof v === 'number').map(String))].sort();
}
function modelSignature(rows: RawMetric[]) { return [...new Set(rows.map(r => rowModels(r).join(',') || '?'))].sort().join('|'); }
function group(rows: RawMetric[]) {
  const map = new Map<string, RawMetric[]>();
  rows.forEach(r => { const id = r.user_id ?? r.member_id ?? r.id; if (typeof id === 'string' || typeof id === 'number') { const k = String(id); map.set(k, [...(map.get(k) || []), r]); } }); return map;
}
export function buildShiftAnalysis(currentRows: RawMetric[], baselineRows: RawMetric[], meta: Omit<ShiftAnalysis, 'totals' | 'operators' | 'findings' | 'cases'>): ShiftAnalysis {
  const prior = group(baselineRows), findings: Finding[] = [];
  const operators = [...group(currentRows)].map(([id, rows]) => {
    const before = prior.get(id) || [], current = aggregateAnalysis(rows), baseline = before.length ? aggregateAnalysis(before) : null;
    const models = [...new Set(rows.flatMap(rowModels))];
    const comparable = !meta.partial && models.length > 0 && before.length > 0 && modelSignature(rows) === modelSignature(before);
    const own: Finding[] = [];
    const op: AnalysisOperator = { id, name: String(rows[0].user_name || rows[0].name || `Оператор #${id}`), models, current, baseline, comparable, findings: own };
    if (comparable && baseline && current.messages_count !== null && baseline.messages_count !== null && current.messages_count >= 50 && baseline.messages_count >= 50) {
      const add = (metric: MetricKey, threshold: number, inverse: boolean, titleDown: string, titleUp: string, actionDown: string, actionUp: string) => {
        const a = current[metric], b = baseline[metric]; if (a === null || b === null || b <= 0) return;
        const change = Math.round((a / b - 1) * 1000) / 10; if (Math.abs(change) < threshold) return;
        const bad = inverse ? change > 0 : change < 0;
        own.push({ id: `${id}:${metric}`, operatorId: id, models, kind: bad ? 'attention' : 'positive', title: bad ? titleDown : titleUp, metric, current: a, baseline: b, change, action: bad ? actionDown : actionUp, caveat: 'Сигнал относительно одного сопоставимого периода прошлой недели, не доказательство причины. Состав аудитории и время активной работы могут отличаться.' });
      };
      add('netPer100', 25, false, 'Меньше дохода на 100 сообщений', 'Больше дохода на 100 сообщений', 'Проверить цены, состав продаж и 5 успешных / 5 непроданных предложений. Выбрать одну гипотезу для теста.', 'Разобрать несколько успешных диалогов с админом и записать проверяемый приём в журнал.');
      add('replySeconds', 30, true, 'Ответы стали медленнее', 'Ответы стали быстрее', 'Проверить очередь, нагрузку и передачу смены. Повторно оценить время ответа после изменения нагрузки.', 'Проверить, сохранилось ли качество ответов; зафиксировать способ организации работы.');
      if ((current.sold_messages_count ?? 0) >= 5 && (baseline.sold_messages_count ?? 0) >= 5)
        add('ppvAverage', 25, false, 'Средний чек PPV снизился', 'Средний чек PPV вырос', 'Проверить изменение состава покупателей и цен. Не повышать все цены только на основании среднего чека.', 'Проверить объём продаж и возвраты, затем обсудить удачные предложения с оператором.');
      if ((current.paid_messages_count ?? 0) >= 20 && (baseline.paid_messages_count ?? 0) >= 20 && (current.soldSentRatio ?? 101) <= 100 && (baseline.soldSentRatio ?? 101) <= 100)
        add('soldSentRatio', 25, false, 'Соотношение покупок и отправок снизилось', 'Соотношение покупок и отправок выросло', 'Проверить запоздалые покупки и выбор аудитории. Сравнить сопоставимые предложения, меняя только один параметр.', 'Отобрать примеры для разбора. Проверить, не относятся ли покупки к сообщениям предыдущих смен.');
      findings.push(...own);
    }
    return op;
  });
  const cases: ShiftAnalysis['cases'] = [];
  if (!meta.partial) for (const op of operators) {
    if (op.models.length !== 1 || (op.current.messages_count ?? 0) < 100 || (op.current.sold_messages_count ?? 0) < 5 || op.current.netPer100 === null) continue;
    const peers = operators.filter(p => p.id !== op.id && p.models.length === 1 && p.models[0] === op.models[0] && (p.current.messages_count ?? 0) >= 100 && (p.current.sold_messages_count ?? 0) >= 5 && p.current.netPer100 !== null && p.current.netPer100 > op.current.netPer100! * 1.3).sort((a, b) => b.current.netPer100! - a.current.netPer100!);
    if (peers[0]) cases.push({ from: peers[0].id, to: op.id, models: op.models, current: op.current.netPer100, peer: peers[0].current.netPer100!, action: 'Внутренний пример для разбора на той же модели. Сравнить аудиторию и 5 диалогов каждого оператора; конкретный успешный подход ещё не установлен.' });
  }
  return { ...meta, totals: aggregateAnalysis(currentRows), operators, findings, cases };
}

export const analysisLimits = [
  'NET — оценка GROSS × 0,8. Здесь продажи операторов, а не весь доход аккаунтов; PayPal и крипта сюда не добавляются.',
  'Продано / отправлено — отношение событий периода, не когортная конверсия. Покупки могут относиться к более ранним отправкам.',
  'Число и средний размер чаевых, цены непроданных PPV и тексты переписок этим источником не подтверждены.',
  'Типы сообщений могут пересекаться. По их долям нельзя определить качество текста или отсутствие экспериментов.',
  'Сравнение — тот же оператор и набор моделей, аналогичный интервал прошлой недели. Сигналы требуют проверки админом.',
];
