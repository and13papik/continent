import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import { ShiftAnalysisSetting } from './ShiftAnalysisSetting';
import { fixture } from '../syncTestFixtures';
import type { AppState } from '../types';

it('defaults to hidden and lets an owner switch both ways without changing other data', () => {
  let state = fixture();
  const before = structuredClone(state);
  const updateState = (update:(s:AppState)=>AppState) => {state = update(state);};
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {renderer = TestRenderer.create(<ShiftAnalysisSetting state={state} updateState={updateState} userRole="owner" />);});
  expect(renderer!.root.findByProps({role:'switch'}).props['aria-checked']).toBe(false);
  act(() => renderer!.root.findByProps({role:'switch'}).props.onClick());
  expect(state).toEqual({...before,shiftAnalysisEnabled:true});
  act(() => {renderer!.update(<ShiftAnalysisSetting state={state} updateState={updateState} userRole="owner" />);});
  expect(renderer!.root.findByProps({role:'switch'}).props['aria-checked']).toBe(true);
  act(() => renderer!.root.findByProps({role:'switch'}).props.onClick());
  expect(state).toEqual({...before,shiftAnalysisEnabled:false});
  act(() => renderer!.unmount());
});
it('does not expose the setting to admins', () => {
  const updateState = vi.fn();
  const renderer = TestRenderer.create(<ShiftAnalysisSetting state={fixture()} updateState={updateState} userRole="user" />);
  expect(renderer.toJSON()).toBeNull();
  expect(updateState).not.toHaveBeenCalled();
  renderer.unmount();
});
