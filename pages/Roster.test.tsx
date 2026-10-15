import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Roster from './Roster';
import { fixture } from '../syncTestFixtures';
import { closedPeriodChanges } from '../closedPeriods';
import type { AppState, RosterEntry } from '../types';

vi.mock('react-dom', () => ({ createPortal: (children: React.ReactNode) => children }));
vi.mock('html2canvas', () => ({ default: vi.fn() }));

let renderer: TestRenderer.ReactTestRenderer;
let state: AppState;
const entry = (id: string, periodId: string, models: string[], operator = 'Admin'): RosterEntry => ({
  id, periodId, models, operator, date: 'monthly', shift: 'morning', createdAt: '2026-10-01T00:00:00Z',
});
function Harness() {
  const [current, setCurrent] = React.useState(state);
  return <Roster state={current} updateState={updater => {
    const next = updater(current);
    expect(closedPeriodChanges(current, next)).toEqual([]);
    state = next;
    setCurrent(next);
    return true;
  }} />;
}
const button = (text: string) => renderer.root.findAllByType('button').find(node => node.children.includes(text))!;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('document', { activeElement: null, body: {} });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({success:true, rosterState:{status:'ok'}}))));
  state = fixture();
  state.operators = ['Admin', 'Replacement'];
  state.accountingPeriods.push({id:'archive',label:'August',startAt:'2026-08-01T00:00:00Z',endAt:'2026-08-31T23:59:59Z',status:'closed'});
  state.rosterData = [entry('current','period',['Model']),entry('archived-empty','archive',[]),entry('archived-assigned','archive',['Model']),entry('unrelated-empty','period',[],'Other')];
  await act(async () => {renderer = TestRenderer.create(<Harness />, {createNodeMock: element => element.type === 'dialog' ? {showModal(){},close(){}} : null});});
});
afterEach(() => {act(() => renderer.unmount());vi.useRealTimers();vi.unstubAllGlobals();});

describe('roster assignment edits preserve unrelated history', () => {
  it('replaces an operator without deleting empty records in closed or unrelated periods', () => {
    const before = structuredClone(state);
    act(() => renderer.root.findByProps({'aria-label':'Model, Утро: Admin'}).props.onClick());
    act(() => button('Заменить оператора').props.onClick());
    const choice = renderer.root.findAllByType('button').find(node => node.props.className?.includes('ct-roster-pick') && node.findAllByType('strong').some(n => n.children.includes('Replacement')))!;
    act(() => choice.props.onClick());
    expect(state.rosterData?.find(e => e.periodId === 'period' && e.models.includes('Model'))?.operator).toBe('Replacement');
    expect(state.deletedIds).toContain('current');
    for (const id of ['archived-empty','archived-assigned','unrelated-empty']) expect(state.rosterData?.find(e => e.id === id)).toEqual(before.rosterData?.find(e => e.id === id));
  });
  it('clears only the chosen assignment and retains the archived empty row', () => {
    const before = structuredClone(state);
    act(() => renderer.root.findByProps({'aria-label':'Model, Утро: Admin'}).props.onClick());
    act(() => button('Убрать из смены').props.onClick());
    expect(state.rosterData?.some(e => e.id === 'current')).toBe(false);
    expect(state.rosterData).toEqual(before.rosterData?.filter(e => e.id !== 'current'));
    expect(state.deletedIds).toEqual(['current']);
  });
});
