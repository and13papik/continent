import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ShiftAnalysisPanel } from './ShiftAnalysisPanel';
import { buildShiftAnalysis, type ShiftAnalysis } from '../shiftAnalysis';

let renderer: TestRenderer.ReactTestRenderer;
let current: ShiftAnalysis, day: ShiftAnalysis;
const now = new Date('2026-10-20T07:00:00Z');
const row = {user_id:'test',creator_ids:['model'],messages_count:200,paid_messages_count:40,sold_messages_count:10,sold_messages_price_sum:100,sold_posts_price_sum:0,tips_amount_sum:0,reply_time_avg:240};
const calls: {action:string; body:any}[] = [];
const button = (label:string) => renderer.root.findAllByType('button').find(n => n.children.includes(label))!;
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); calls.length = 0;
  const options = {id:'current',generatedAt:now.toISOString(),period:'current' as const,window:{start:now.toISOString(),end:now.toISOString(),label:''},baselineWindow:{start:now.toISOString(),end:now.toISOString(),label:''},partial:false,quality:[]};
  current = buildShiftAnalysis([row],[row],options);
  day = buildShiftAnalysis([row],[{...row,sold_messages_price_sum:250}],{...options,id:'day',period:'day'});
  vi.stubGlobal('fetch',vi.fn(async (url:string, init?:RequestInit) => {
    const query = new URL(url,'https://test.invalid').searchParams, action = query.get('action')!;
    calls.push({action,body:init?.body ? JSON.parse(init.body as string) : null});
    return new Response(JSON.stringify(action === 'report' ? {report:query.get('period') === 'day' ? day : current,journalReady:true,aiConfigured:true}
      : action === 'experiments' ? {experiments:[]} : {advice:{summary:'Проверка',actions:[]}}));
  }));
  await act(async () => {renderer = TestRenderer.create(<ShiftAnalysisPanel />);});
});
afterEach(() => {act(() => renderer.unmount()); vi.useRealTimers(); vi.unstubAllGlobals();});
const open = async () => {await act(async () => renderer.root.findByProps({className:'sa-toggle'}).props.onClick());};

it('explains no signals and opens a usable 24-hour report without charging AI', async () => {
  await open();
  expect(button('Получить AI-разбор').props.disabled).toBe(true);
  expect(renderer.root.findByProps({id:'sa-ai-reason'}).children.join('')).toContain('нет сравнительных сигналов');
  await act(async () => button('Перейти к 24 часам').props.onClick());
  expect(button('Получить AI-разбор').props.disabled).toBe(false);
  expect(calls.filter(c => c.action === 'ai')).toHaveLength(0);
});
it('refreshes an expired snapshot before AI and submits only the new report ID', async () => {
  current = {...day,id:'old',period:'current',generatedAt:new Date(now.getTime()-6*60000).toISOString()};
  await open();
  expect(button('Обновить и разобрать').props.disabled).toBe(false);
  current = {...day,id:'fresh',period:'current'};
  await act(async () => button('Обновить и разобрать').props.onClick());
  expect(calls.filter(c => c.action === 'ai')).toEqual([{action:'ai',body:{reportId:'fresh'}}]);
});
it('does not charge AI when refreshing an expired snapshot returns incomplete data', async () => {
  current = {...day,id:'old',period:'current',generatedAt:new Date(now.getTime()-6*60000).toISOString()};
  await open();
  current = {...day,id:'partial',period:'current',partial:true,findings:[]};
  await act(async () => button('Обновить и разобрать').props.onClick());
  expect(calls.filter(c => c.action === 'ai')).toHaveLength(0);
  expect(button('Получить AI-разбор').props.disabled).toBe(true);
  expect(button('Повторить загрузку')).toBeDefined();
});
it('does not charge AI when the refreshed report has no comparison signals', async () => {
  const noSignals = current;
  current = {...day,id:'old',period:'current',generatedAt:new Date(now.getTime()-6*60000).toISOString()};
  await open(); current = noSignals;
  await act(async () => button('Обновить и разобрать').props.onClick());
  expect(calls.filter(c => c.action === 'ai')).toHaveLength(0);
  expect(button('Перейти к 24 часам')).toBeDefined();
});
