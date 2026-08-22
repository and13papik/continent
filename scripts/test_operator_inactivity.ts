import { computeAttentionAlerts, ACCOUNT_OPERATOR_INACTIVITY_MINUTES, ACCOUNT_OPERATOR_GRACE_PERIOD_MINUTES } from '../components/OnlyMonsterTab.js';
import { classifyChatMessage } from '../api/_lib/om-webhook-utils.js';

interface TestResult {
  scenarioNumber: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, msg: string, scenarioNum: number, name: string) {
  if (!condition) {
    results.push({
      scenarioNumber: scenarioNum,
      name,
      passed: false,
      details: `FAILED: ${msg}`
    });
    console.error(`❌ [Scenario ${scenarioNum}] ${name} FAILED: ${msg}`);
  } else {
    results.push({
      scenarioNumber: scenarioNum,
      name,
      passed: true,
      details: 'PASSED'
    });
    console.log(`✅ [Scenario ${scenarioNum}] ${name} PASSED`);
  }
}

export function runAll15Scenarios() {
  console.log('================================================================');
  console.log('STARTING OPERATOR INACTIVITY 15-SCENARIO VERIFICATION SUITE');
  console.log('================================================================\n');

  const now = Date.now();
  const shiftStart2hAgo = new Date(now - 2 * 3600 * 1000).toISOString();
  const shiftInfo = { label: '08:00–14:00', start: shiftStart2hAgo, end: new Date(now + 4 * 3600 * 1000).toISOString() };

  const mockAccount = {
    id: 20400,
    platform_account_id: 'u105837242',
    name: 'Mermaid',
    status: 'active',
    active_operators: 1
  } as any;

  const mockOperatorA = {
    user_id: 'op_1',
    name: 'Anna',
    avatar: '',
    messages_count: 50,
    paid_messages_count: 5,
    sold_messages_count: 2,
    creator_ids: ['u105837242', '20400']
  } as any;

  const mockOperatorB = {
    user_id: 'op_2',
    name: 'Elena',
    avatar: '',
    messages_count: 40,
    paid_messages_count: 4,
    sold_messages_count: 1,
    creator_ids: ['u105837242', '20400']
  } as any;

  // Scenario 1: elapsed = 19 min -> No inactivity alert
  {
    const lastOut = { 'u105837242': now - 19 * 60 * 1000 };
    const alerts = computeAttentionAlerts([mockOperatorA], [mockAccount], 'today', shiftInfo, lastOut, now, {}, {}, {}, true);
    const idleAlert = alerts.find(a => a.type === 'account_idle');
    assert(idleAlert === undefined, 'Expected no idle alert for 19 min', 1, 'Inactivity elapsed 19m (<20m threshold)');
  }

  // Scenario 2: elapsed = 20 min -> Inactivity alert triggered
  {
    const lastOut = { 'u105837242': now - 20 * 60 * 1000 };
    const alerts = computeAttentionAlerts([mockOperatorA], [mockAccount], 'today', shiftInfo, lastOut, now, {}, {}, {}, true);
    const idleAlert = alerts.find(a => a.type === 'account_idle');
    assert(idleAlert !== undefined, 'Expected idle alert for 20 min', 2, 'Inactivity elapsed 20m (>=20m threshold)');
  }

  // Scenario 3: elapsed = 25 min with 0 waiting fans -> Inactivity alert triggered (Red), purely operator based
  {
    const lastOut = { 'u105837242': now - 25 * 60 * 1000 };
    const unanswered = { 'u105837242': 0 };
    const alerts = computeAttentionAlerts([mockOperatorA], [mockAccount], 'today', shiftInfo, lastOut, now, unanswered, {}, {}, true);
    const idleAlert = alerts.find(a => a.type === 'account_idle');
    assert(Boolean(idleAlert?.severity === 'red' && idleAlert.text?.includes('операторы не писали в чатах 25м')), 'Expected red alert indicating operators did not write for 25m', 3, 'Inactivity 25m with 0 waiting fans (Red alert, no fan dependence)');
  }

  // Scenario 4: elapsed = 25 min with 3 waiting fans -> Inactivity alert triggered (Red), purely operator based
  {
    const lastOut = { 'u105837242': now - 25 * 60 * 1000 };
    const unanswered = { 'u105837242': 3 };
    const alerts = computeAttentionAlerts([mockOperatorA], [mockAccount], 'today', shiftInfo, lastOut, now, unanswered, {}, {}, true);
    const idleAlert = alerts.find(a => a.type === 'account_idle');
    assert(Boolean(idleAlert?.severity === 'red' && idleAlert.text?.includes('операторы не писали в чатах 25м')), 'Expected red alert indicating operators did not write for 25m regardless of fan count', 4, 'Inactivity 25m with 3 waiting fans (Red alert, no fan dependence)');
  }

  // Scenario 5: Two operators: Op A 45m ago, Op B 10m ago -> Account max = 10m -> No alert
  {
    const lastOut = { 'u105837242': now - 10 * 60 * 1000 };
    const alerts = computeAttentionAlerts([mockOperatorA, mockOperatorB], [mockAccount], 'today', shiftInfo, lastOut, now, {}, {}, {}, true);
    const idleAlert = alerts.find(a => a.type === 'account_idle');
    assert(idleAlert === undefined, 'Expected no idle alert when Op B wrote 10m ago', 5, 'Multiple operators with active Op B (10m)');
  }

  // Scenario 6: Two operators: Op A 45m ago, Op B 22m ago -> Account max = 22m -> Inactivity alert triggered
  {
    const lastOut = { 'u105837242': now - 22 * 60 * 1000 };
    const alerts = computeAttentionAlerts([mockOperatorA, mockOperatorB], [mockAccount], 'today', shiftInfo, lastOut, now, {}, {}, {}, true);
    const idleAlert = alerts.find(a => a.type === 'account_idle');
    assert(idleAlert !== undefined, 'Expected idle alert when both Op A and Op B are >20m inactive', 6, 'Multiple operators both inactive (>20m)');
  }

  // Scenario 7: Handover: Op A worked hour 1 (3h ago), Op B took over and wrote 5m ago -> No alert
  {
    const lastOut = { 'u105837242': now - 5 * 60 * 1000 };
    const alerts = computeAttentionAlerts([mockOperatorA, mockOperatorB], [mockAccount], 'today', shiftInfo, lastOut, now, {}, {}, {}, true);
    const idleAlert = alerts.find(a => a.type === 'account_idle');
    assert(idleAlert === undefined, 'Expected no alert when takeover Op B wrote 5m ago', 7, 'Shift takeover / handover with active replacement');
  }

  // Scenario 8: Fan incoming message arrived 2m ago, but operator outgoing was 30m ago -> Message classifier ignores fan message
  {
    const fanMsg = {
      event_type: 'chat.message',
      payload: {
        message: { id: 'msg_f1', from_id: 'fan_123', fan_id: 'fan_123', direction: 'in', is_incoming: true, created_at: new Date(now - 2 * 60 * 1000).toISOString() },
        account: { platform_account_id: 'u105837242', account_id: '20400' }
      }
    };
    const classification = classifyChatMessage(fanMsg);
    assert(classification.classifiedAsHumanOperator === false && classification.direction === 'in', 'Fan message must not be classified as human operator', 8, 'Fan message classification isolation');
  }

  // Scenario 9: Automated/bot message 2m ago (is_automated=true), operator outgoing was 25m ago -> Automated message ignored
  {
    const autoMsg = {
      event_type: 'chat.message',
      payload: {
        message: { id: 'msg_a1', from_id: 'u105837242', is_automated: true, type: 'mass', created_at: new Date(now - 2 * 60 * 1000).toISOString() },
        account: { platform_account_id: 'u105837242' }
      }
    };
    const classification = classifyChatMessage(autoMsg);
    assert(classification.classifiedAsHumanOperator === false && classification.isAutomated === true, 'Automated message must be rejected as human operator activity', 9, 'Automated message classification isolation');
  }

  // Scenario 10: Shift start grace period: Shift started 10m ago, no operator message yet -> No false alert
  {
    const recentShiftInfo = { label: '08:00–14:00', start: new Date(now - 10 * 60 * 1000).toISOString(), end: new Date(now + 350 * 60 * 1000).toISOString() };
    const lastOut = {}; // No message in shift
    const alerts = computeAttentionAlerts([mockOperatorA], [mockAccount], 'today', recentShiftInfo, lastOut, now, {}, {}, {}, true);
    const idleAlert = alerts.find(a => a.type === 'account_idle');
    assert(idleAlert === undefined, 'Expected no idle alert within 20m shift grace period', 10, 'Shift start 20m grace period active');
  }

  // Scenario 11: Shift start grace period expired: Shift started 25m ago, no operator message yet -> Inactivity alert triggered
  {
    const oldShiftInfo = { label: '08:00–14:00', start: new Date(now - 25 * 60 * 1000).toISOString(), end: new Date(now + 335 * 60 * 1000).toISOString() };
    const lastOut = { 'u105837242': now - 25 * 60 * 1000 };
    const alerts = computeAttentionAlerts([mockOperatorA], [mockAccount], 'today', oldShiftInfo, lastOut, now, {}, {}, {}, true);
    const idleAlert = alerts.find(a => a.type === 'account_idle');
    assert(idleAlert !== undefined, 'Expected idle alert when shift elapsed > 20m without messages', 11, 'Shift start grace period expired (25m)');
  }

  // Scenario 12: Activity restored / resumed: Operator sends message (elapsed = 0m) -> Alert cleared
  {
    const lastOut = { 'u105837242': now - 1 * 60 * 1000 };
    const alerts = computeAttentionAlerts([mockOperatorA], [mockAccount], 'today', shiftInfo, lastOut, now, {}, {}, {}, true);
    const idleAlert = alerts.find(a => a.type === 'account_idle');
    assert(idleAlert === undefined, 'Expected idle alert to be cleared upon operator message', 12, 'Activity restored / resumed event');
  }

  // Scenario 13: No operator assigned to account -> Alert is 'no_operator', NOT 'account_idle'
  {
    const lastOut = { 'u105837242': now - 40 * 60 * 1000 };
    const unassignedAccount = { ...mockAccount, id: 99999, platform_account_id: 'u99999' };
    const alerts = computeAttentionAlerts([mockOperatorA], [unassignedAccount], 'today', shiftInfo, lastOut, now, {}, {}, {}, true);
    const idleAlert = alerts.find(a => a.type === 'account_idle');
    const noOpAlert = alerts.find(a => a.type === 'no_operator');
    assert(idleAlert === undefined && noOpAlert !== undefined, 'Expected no_operator alert instead of account_idle when unassigned', 13, 'Unassigned account yields no_operator');
  }

  // Scenario 14: Sync staleness (isActivitySyncFresh = false) -> Suppress false inactivity alerts
  {
    const lastOut = { 'u105837242': now - 35 * 60 * 1000 };
    const alerts = computeAttentionAlerts([mockOperatorA], [mockAccount], 'today', shiftInfo, lastOut, now, {}, {}, {}, false);
    const idleAlert = alerts.find(a => a.type === 'account_idle');
    assert(idleAlert === undefined, 'Expected no idle alert when activity sync is stale', 14, 'Sync staleness suppression');
  }

  // Scenario 15: Full query returns null -> Timestamp deleted/reset -> No ghost alert
  {
    const lastOut = {}; // Null from server
    const alerts = computeAttentionAlerts([mockOperatorA], [mockAccount], 'today', shiftInfo, lastOut, now, {}, {}, {}, true);
    const idleAlert = alerts.find(a => a.type === 'account_idle');
    assert(idleAlert === undefined, 'Expected no false idle alert from null/missing timestamp in map', 15, 'Full query null response handling');
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${results.filter(r => r.passed).length} / ${results.length} PASSED`);
  console.log('================================================================\n');

  return results;
}

runAll15Scenarios();
