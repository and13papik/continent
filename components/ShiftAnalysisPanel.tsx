import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, FlaskConical, RefreshCw, Sparkles } from 'lucide-react';
import { analysisFields, analysisLimits, type AnalysisPeriod, type ShiftAnalysis, type Metrics, type MetricKey } from '../shiftAnalysis';
import type { AiAnalysis } from '../api/_lib/shift-analysis-service';
import './ShiftAnalysisPanel.css';

type Experiment = { id: string; operator_id: string; title: string; hypothesis: string; plan: string; success_metric: string; stop_condition: string; status: string; revision: number; result: string; outcome: string; source_url: string; source_note: string; created_at: string; baseline: { window: { start: string; end: string }; operator: { current: Metrics } } };
const periods = { current: 'Текущая смена', previous: 'Предыдущая смена', day: '24 часа' };
const date = (s: string) => new Date(s).toLocaleString('ru-RU', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
function value(k: MetricKey, n: number | null) {
  if (n === null) return 'Нет данных';
  const type = analysisFields[k][1];
  if (type === 'seconds') return `${Math.round(n)} с`;
  return `${type === 'money' ? '$' : ''}${n.toLocaleString('ru-RU', { maximumFractionDigits: type === 'count' ? 0 : 2 })}${type === 'percent' ? '%' : ''}`;
}
const blank = { operatorId: '', title: '', hypothesis: '', plan: '', successMetric: '', stopCondition: '', sourceUrl: '', sourceNote: '' };
async function request(action: string, init?: RequestInit) {
  const response = await fetch(`/api/onlymonster/shift-analysis?${action}`, init);
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Не удалось получить разбор'); return data;
}
const post = (body: unknown, method = 'POST') => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export function ShiftAnalysisPanel({ operatorNames = {}, modelNames = {} }: { operatorNames?: Record<string, string>; modelNames?: Record<string, string> }) {
  const [open, setOpen] = useState(false), [period, setPeriod] = useState<AnalysisPeriod>('current');
  const [tab, setTab] = useState('overview'), [data, setData] = useState<ShiftAnalysis | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const [journalReady, setJournalReady] = useState(false), [aiConfigured, setAiConfigured] = useState(false);
  const [advice, setAdvice] = useState<AiAnalysis | null>(null), [aiBusy, setAiBusy] = useState(false), [aiError, setAiError] = useState('');
  const [experiments, setExperiments] = useState<Experiment[]>([]), [journalError, setJournalError] = useState('');
  const [form, setForm] = useState(blank), [showForm, setShowForm] = useState(false), [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now()), [resultDrafts, setResultDrafts] = useState<Record<string, { result: string; outcome: string }>>({});
  const activeReport = useRef('');
  const opName = (id: string) => operatorNames[id] || data?.operators.find(o => o.id === id)?.name || `Оператор #${id}`;
  const models = (ids: string[]) => ids.map(id => modelNames[id] || `Модель #${id}`).join(', ') || 'Модель не определена';
  useEffect(() => { if (!open) return; const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, [open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); setLoading(true); setError(''); setData(null); setAdvice(null); setAiError(''); activeReport.current = '';
    request(`action=report&period=${period}`, { signal: controller.signal }).then(r => { if (!controller.signal.aborted) { setData(r.report); activeReport.current = r.report.id; setJournalReady(r.journalReady); setAiConfigured(r.aiConfigured); } }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, period, revision]);
  useEffect(() => { if (!open) return; const controller = new AbortController(); request('action=experiments', { signal: controller.signal }).then(r => { if (!controller.signal.aborted) { setExperiments(r.experiments); setJournalError(''); } }).catch(e => { if (!controller.signal.aborted) setJournalError(e.message); }); return () => controller.abort(); }, [open, revision]);
  const ai = async () => {
    if (!data || aiBusy) return; let id = data.id; setAiBusy(true); setAiError('');
    try {
      if (Date.now() - Date.parse(data.generatedAt) > 5 * 60000) {
        const fresh = await request(`action=report&period=${period}`);
        if (activeReport.current !== id) return;
        id = fresh.report.id; activeReport.current = id;
        setData(fresh.report); setNow(Date.now()); setAdvice(null);
        setJournalReady(fresh.journalReady); setAiConfigured(fresh.aiConfigured);
        if (!fresh.aiConfigured) throw new Error('AI ещё не подключён на сервере.');
        if (!fresh.journalReady) throw new Error('Не удалось сохранить снимок. Повторите загрузку разбора.');
        if (fresh.report.partial) throw new Error('OnlyMonster вернул неполные данные. Повторите загрузку разбора.');
        if (!fresh.report.findings.length) throw new Error('В обновлённом периоде нет сравнительных сигналов для AI. Выберите другой период или откройте «Все метрики».');
      }
      const r = await request('action=ai', post({ reportId: id })); if (activeReport.current === id) setAdvice(r.advice);
    }
    catch (e) { if (activeReport.current === id) setAiError((e as Error).message); } finally { setAiBusy(false); }
  };
  const prepare = (fields: Partial<typeof blank>) => { setForm({ ...blank, operatorId: data?.operators[0]?.id || '', ...fields }); setShowForm(true); setTab('experiments'); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!data) return; setSaving(true); setJournalError('');
    try { const r = await request('action=experiments', post({ ...form, reportId: data.id })); setExperiments(prev => [r.experiment, ...prev]); setShowForm(false); setForm(blank); }
    catch (e) { setJournalError((e as Error).message); } finally { setSaving(false); }
  };
  const changeStatus = async (x: Experiment, status: string) => {
    setSaving(true); setJournalError('');
    try { const r = await request('action=experiments', post({ id: x.id, revision: x.revision, status, result: resultDrafts[x.id]?.result || '', outcome: resultDrafts[x.id]?.outcome || 'inconclusive' }, 'PATCH')); setExperiments(prev => prev.map(p => p.id === x.id ? r.experiment : p)); }
    catch (e) { setJournalError((e as Error).message); } finally { setSaving(false); }
  };
  const findings = data?.findings || [], stale = data ? now - Date.parse(data.generatedAt) > 5 * 60000 : false;
  const aiReason = !aiConfigured ? 'AI ещё не подключён на сервере.'
    : !journalReady ? 'Не удалось сохранить снимок для AI. Повторите загрузку разбора.'
    : stale ? 'Показатели старше 5 минут. По нажатию обновим данные и запустим AI, если есть сигналы для анализа.'
    : data?.partial ? 'OnlyMonster вернул неполные данные. AI станет доступен после полной загрузки.'
    : !findings.length ? `В этом периоде нет сравнительных сигналов для AI: выборка может быть мала, отсутствовать база сравнения или изменения не достигли порогов. ${period !== 'day' ? 'Попробуйте разбор за 24 часа. ' : ''}Все показатели доступны во вкладке «Все метрики».`
    : '';
  const aiDisabled = aiBusy || !aiConfigured || !journalReady || (!stale && Boolean(data?.partial || !findings.length));
  const table = (current: Metrics, baseline?: Metrics | null) => <div className="sa-table-wrap"><table><thead><tr><th>Показатель</th><th>Период</th>{baseline && <th>Прошлая неделя</th>}</tr></thead><tbody>{(Object.keys(analysisFields) as MetricKey[]).map(k => <tr key={k}><td>{analysisFields[k][0]}</td><td>{value(k, current[k])}</td>{baseline && <td>{value(k, baseline[k])}</td>}</tr>)}</tbody></table></div>;
  return <section className="sa-panel">
    <button className="sa-toggle" aria-expanded={open} onClick={() => setOpen(!open)}><span><FlaskConical size={18} /><strong>Разбор смены</strong><small>Проблемы · сильные стороны · эксперименты</small></span><ChevronDown size={17} style={{ transform: open ? 'rotate(180deg)' : undefined }} /></button>
    {open && <div className="sa-body">
      <div className="sa-toolbar"><div className="om-segment">{(Object.keys(periods) as AnalysisPeriod[]).map(p => <button key={p} aria-pressed={period === p} onClick={() => { if (showForm || aiBusy) return; setPeriod(p); }} disabled={showForm || aiBusy}>{periods[p]}</button>)}</div><button className="ct-button" disabled={loading || showForm || aiBusy} onClick={() => setRevision(r => r + 1)}><RefreshCw size={14} />Обновить разбор</button></div>
      {loading && <p className="sa-muted" role="status">Получаем показатели и сопоставимый период…</p>}
      {error && <p className="om-error" role="alert">{error}</p>}
      {data && <>
        <p className="sa-context">{date(data.window.start)} — {date(data.window.end)} · Киев · снимок {date(data.generatedAt)}{stale ? ' · устарел, обновите' : ''}</p>
        <p className="sa-context">Сравнение: {date(data.baselineWindow.start)} — {date(data.baselineWindow.end)}. Один сопоставимый период, не устойчивая норма.</p>
        {(data.partial || data.quality.length > 0) && <div className="om-notice">{data.partial && <strong>Неполные данные: сравнительные выводы отключены. </strong>}{data.quality.join('. ')}</div>}
        <div className="sa-kpis"><div><span>Продажи операторов · NET ≈</span><strong>{value('net', data.totals.net)}</strong></div><div><span>Нужно проверить</span><strong>{findings.filter(f => f.kind === 'attention').length}</strong></div><div><span>Положительные сигналы</span><strong>{findings.filter(f => f.kind === 'positive').length}</strong></div><div><span>Операторов в данных</span><strong>{data.operators.length}</strong></div></div>
        <div className="om-segment sa-tabs">{[['overview', 'Выводы'], ['operators', 'Все метрики'], ['cases', 'Кейсы команды'], ['experiments', 'Эксперименты']].map(([k, label]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>)}</div>
        {tab === 'overview' && <>
          {!findings.length && <p className="sa-empty">Сравнительных сигналов по заданным порогам нет. Это может означать стабильные показатели, малую выборку или отсутствие базы сравнения — не оценка «всё идеально».</p>}
          <div className="sa-findings">{findings.map(f => <article key={f.id} className={`sa-finding sa-${f.kind}`}><header><span>{f.kind === 'attention' ? 'Проверить' : 'Сильная сторона'}</span><b>{opName(f.operatorId)}</b></header><h3>{f.title}</h3><p>{models(f.models)}</p><div className="sa-evidence"><strong>{value(f.metric, f.current)}</strong><span>против {value(f.metric, f.baseline)} · {f.change > 0 ? '+' : ''}{f.change}%</span></div><p>{f.action}</p><details><summary>Основание и ограничения</summary><p>{analysisFields[f.metric][0]}. {f.caveat}</p></details><button className="sa-link" disabled={!journalReady} onClick={() => prepare({ operatorId: f.operatorId, title: f.title, hypothesis: 'Гипотеза требует проверки: ', plan: f.action, successMetric: analysisFields[f.metric][0], stopCondition: 'Остановить при ухудшении качества ответов, жалобах или недостаточной сопоставимости групп.' })}>Запланировать проверку →</button></article>)}</div>
          <div className="sa-ai"><header><div><h3><Sparkles size={16} />Рекомендации админу</h3><p>AI объясняет сигналы и предлагает проверки. Расчёты доступны независимо от AI.</p></div><button className="ct-button ct-button-primary" disabled={aiDisabled} aria-describedby={aiReason ? "sa-ai-reason" : undefined} onClick={ai}>{aiBusy ? 'Готовим разбор…' : stale ? 'Обновить и разобрать' : 'Получить AI-разбор'}</button></header>
          {aiReason && <div className="sa-ai-status" role="status"><p id="sa-ai-reason">{aiReason}</p><div className="sa-ai-recovery">{aiConfigured && (!journalReady || data.partial) && <button className="ct-button" disabled={aiBusy || loading} onClick={() => setRevision(r => r + 1)}><RefreshCw size={14} />Повторить загрузку</button>}{aiConfigured && journalReady && !data.partial && !findings.length && !stale && <>{period !== 'day' && <button className="ct-button" disabled={aiBusy} onClick={() => setPeriod('day')}>Перейти к 24 часам</button>}<button className="sa-link" onClick={() => setTab('operators')}>Посмотреть все метрики →</button></>}</div></div>}{aiError && <p className="om-error" role="alert">{aiError}</p>}{advice && <><p>{advice.summary}</p>{advice.actions.map((a, i) => { const f = findings.find(f => f.id === a.findingId); return <article className="sa-advice" key={i}><strong>{f ? opName(f.operatorId) + ' · ' + f.title : 'Проверка'}</strong><p><b>Гипотеза:</b> {a.interpretation}</p><p><b>Проверить:</b> {a.check}</p><p><b>Эксперимент:</b> {a.experiment}</p><p><b>Измерить:</b> {a.successMetric}</p><p><b>Остановить:</b> {a.stopCondition}</p><button className="sa-link" onClick={() => prepare({ operatorId: f?.operatorId, title: f?.title, hypothesis: a.interpretation, plan: a.experiment, successMetric: a.successMetric, stopCondition: a.stopCondition })}>В журнал экспериментов →</button></article>; })}<small>AI-предложения требуют проверки админом; причины и ожидаемый рост не подтверждены.</small></>}</div>
        </>}
        {tab === 'operators' && <><details><summary>Общие показатели периода</summary>{table(data.totals)}</details>{data.operators.map(o => <details key={o.id} className="sa-operator"><summary><strong>{opName(o.id)}</strong><span>{models(o.models)}</span><b>{value('net', o.current.net)}</b></summary><p className="sa-muted">{o.comparable ? 'Тот же оператор и набор моделей.' : 'Сравнение ограничено: другой набор моделей, нет базы или неполные данные.'} Активные часы и состав аудитории не подтверждены.</p>{table(o.current, o.baseline)}</details>)}</>}
        {tab === 'cases' && <><p className="sa-muted">Внутренние примеры на той же модели. Лучший результат не доказывает конкретный приём — нужен ручной разбор диалогов.</p>{data.cases.length === 0 && <p className="sa-empty">Для сравнения коллег пока недостаточно сопоставимых наблюдений: нужны одна и та же модель, от 100 сообщений и 5 продаж у каждого.</p>}{data.cases.map(c => <article className="sa-advice" key={c.to}><h3>{opName(c.to)} → разбор с {opName(c.from)}</h3><p>{models(c.models)} · NET на 100 сообщений: {value('netPer100', c.current)} и {value('netPer100', c.peer)}</p><p>{c.action}</p><button className="sa-link" disabled={!journalReady} onClick={() => prepare({ operatorId: c.to, title: 'Разбор внутреннего кейса', hypothesis: 'Часть отличия может быть связана с подходом к предложениям, а не только с аудиторией.', plan: c.action, successMetric: 'NET на 100 сообщений, число продаж и жалобы; сравнить сопоставимые группы.', sourceNote: `Внутренний пример: оператор ${opName(c.from)}, снимок ${date(data.generatedAt)}` })}>Запланировать разбор →</button></article>)}<button className="ct-button" disabled={!journalReady || !data.operators.length} onClick={() => prepare({ title: 'Проверка внешнего кейса', sourceNote: 'Источник и применимость ещё требуют проверки.' })}>Добавить внешний кейс со ссылкой</button></>}
        {tab === 'experiments' && <><div className="sa-toolbar"><p className="sa-muted">Общий журнал админов. Отсутствие записи не означает, что подход никогда не пробовали.</p><button className="ct-button" disabled={!journalReady || !data.operators.length} onClick={() => prepare({})}>Новый эксперимент</button></div>{journalError && <p className="om-error" role="alert">{journalError}</p>}{!journalReady && <p className="om-notice">Общее хранилище ещё не подключено. Сохранение недоступно.</p>}
          {showForm && <form className="sa-form" onSubmit={save}><h3>План проверки</h3><label>Оператор<select required value={form.operatorId} onChange={e => setForm({ ...form, operatorId: e.target.value })}>{data.operators.map(o => <option key={o.id} value={o.id}>{opName(o.id)}</option>)}</select></label>{([['title', 'Название', 180], ['hypothesis', 'Гипотеза: что и почему может сработать', 2000], ['plan', 'Один изменяемый параметр, группы и срок проверки', 2000], ['successMetric', 'Метрика, минимальная выборка и критерий успеха', 1000], ['stopCondition', 'Когда остановить тест', 1000], ['sourceUrl', 'Ссылка на внешний кейс (необязательно)', 1000], ['sourceNote', 'Источник / что проверить в кейсе (необязательно)', 1500]] as const).map(([k, label, max]) => <label key={k}>{label}<textarea rows={k === 'title' || k === 'sourceUrl' ? 1 : 2} maxLength={max} required={!['sourceUrl', 'sourceNote'].includes(k)} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} /></label>)}<p className="sa-muted">Сохраним исходные показатели и период этого разбора. Результат теста оценивает админ; система не объявляет причинную связь автоматически.</p><div className="sa-toolbar"><button className="ct-button ct-button-primary" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить план'}</button><button className="ct-button" type="button" disabled={saving} onClick={() => setShowForm(false)}>Отмена</button></div></form>}
          {!experiments.length && !journalError && <p className="sa-empty">В журнале пока нет экспериментов. Начните с одного изменения и заранее определите критерий результата.</p>}
          {experiments.map(x => <article className="sa-advice" key={x.id}><header><h3>{x.title}</h3><span>{({ planned: 'Запланирован', active: 'В работе', completed: 'Завершён', stopped: 'Остановлен' } as Record<string, string>)[x.status]} · {opName(x.operator_id)}</span></header><p><b>Гипотеза:</b> {x.hypothesis}</p><p><b>План:</b> {x.plan}</p><p><b>Успех:</b> {x.success_metric}</p><p><b>Остановка:</b> {x.stop_condition}</p>{x.source_url && <a href={x.source_url} target="_blank" rel="noopener noreferrer">Источник кейса ↗</a>}{x.source_note && <p>{x.source_note}</p>}<details><summary>Исходные показатели · {date(x.baseline.window.start)}</summary>{table(x.baseline.operator.current)}</details>{x.result && <p><b>Оценка админа:</b> {({ promising: 'Перспективно', no_improvement: 'Улучшения нет', inconclusive: 'Недостаточно данных', pending: 'Не оценено' } as Record<string, string>)[x.outcome]}. {x.result}</p>}{['planned', 'active'].includes(x.status) && <div className="sa-result"><label>Наблюдения и результат<textarea aria-label={`Результат: ${x.title}`} maxLength={3000} value={resultDrafts[x.id]?.result || ''} onChange={e => setResultDrafts({ ...resultDrafts, [x.id]: { outcome: resultDrafts[x.id]?.outcome || 'inconclusive', result: e.target.value } })} /></label>{x.status === 'active' && <select aria-label={`Оценка: ${x.title}`} value={resultDrafts[x.id]?.outcome || 'inconclusive'} onChange={e => setResultDrafts({ ...resultDrafts, [x.id]: { result: resultDrafts[x.id]?.result || '', outcome: e.target.value } })}><option value="inconclusive">Недостаточно данных</option><option value="promising">Перспективно — оценка админа</option><option value="no_improvement">Улучшения нет</option></select>}<div className="sa-toolbar"><button className="ct-button" disabled={saving || (x.status === 'active' && !resultDrafts[x.id]?.result.trim())} onClick={() => changeStatus(x, x.status === 'planned' ? 'active' : 'completed')}>{x.status === 'planned' ? 'Начать тест' : 'Завершить с результатом'}</button><button className="ct-button" disabled={saving || !resultDrafts[x.id]?.result.trim()} onClick={() => changeStatus(x, 'stopped')}>Остановить</button></div></div>}</article>)}
        </>}
        <details className="sa-method"><summary>Как считаем и что пока нельзя заключить</summary><ul>{analysisLimits.map(s => <li key={s}>{s}</li>)}</ul><p>Пороги сигналов: от 50 сообщений в обоих периодах; для среднего чека — от 5 продаж; для отношения покупок к отправкам — от 20 отправок. Изменение от 25% (ответ — от 30%). Это рабочие фильтры для ручной проверки, не статистическая значимость.</p></details>
      </>}
    </div>}
  </section>;
}
