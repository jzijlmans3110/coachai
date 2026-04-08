// Plain JS port of computeChurnRisk from src/pages/Dashboard.tsx
// Run with: node test-churn.mjs

function computeChurnRisk(client, checkIns) {
  const clientCheckIns = checkIns
    .filter(c => c.client_id === client.id)
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())

  const reasons = []
  let score = 0

  // Days since last check-in
  let daysSinceCheckIn = null
  if (clientCheckIns.length === 0) {
    score += 40
    reasons.push('Nog nooit ingecheckt')
  } else {
    daysSinceCheckIn = Math.floor((Date.now() - new Date(clientCheckIns[0].submitted_at).getTime()) / 86400000)
    if (daysSinceCheckIn > 21) { score += 40; reasons.push(`${daysSinceCheckIn} dagen geen check-in`) }
    else if (daysSinceCheckIn > 10) { score += 20; reasons.push(`${daysSinceCheckIn} dagen geen check-in`) }
  }

  // Energy trend (last 3)
  if (clientCheckIns.length >= 3) {
    const [e1, e2, e3] = clientCheckIns.slice(0, 3).map(c => c.energy)
    // clientCheckIns is sorted newest-first, so e1=newest, e2=middle, e3=oldest
    // Declining trend means energy was HIGH in past and is LOW now: e3 > e2 > e1
    if (e1 < e2 && e2 < e3) { score += 25; reasons.push('Dalende energietrend') }
    else if (e1 < 5) { score += 15; reasons.push('Lage energie bij laatste check-in') }
  } else if (clientCheckIns.length === 1 && clientCheckIns[0].energy < 5) {
    score += 15
    reasons.push('Lage energie bij laatste check-in')
  }

  // Few check-ins vs client age
  const clientAgeDays = Math.floor((Date.now() - new Date(client.created_at).getTime()) / 86400000)
  const expectedCheckIns = Math.floor(clientAgeDays / 7)
  if (expectedCheckIns > 2 && clientCheckIns.length < expectedCheckIns * 0.4) {
    score += 20
    reasons.push('Weinig check-ins vergeleken met inschrijfduur')
  }

  // Status
  if (client.status === 'inactief') { score += 15; reasons.push('Status: inactief') }

  score = Math.min(score, 100)
  const level = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low'

  const suggestions = {
    high: 'Neem direct contact op — stuur een persoonlijk bericht of bel om te vragen hoe het gaat.',
    medium: 'Stuur een motiverende check-in reminder en vraag actief naar voortgang.',
    low: 'Client is betrokken — houd momentum vast met positieve feedback.',
  }

  return { client, score, level, reasons, suggestion: suggestions[level], daysSinceCheckIn }
}

// --- Test helpers ---

let passed = 0
let failed = 0

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString()
}

function assert(label, condition, details = '') {
  if (condition) {
    console.log(`  PASS  ${label}`)
    passed++
  } else {
    console.log(`  FAIL  ${label}${details ? ' — ' + details : ''}`)
    failed++
  }
}

function makeClient(overrides = {}) {
  return {
    id: 'client-1',
    full_name: 'Test Client',
    status: 'actief',
    created_at: daysAgo(60), // 60 days old by default
    level: 'beginner',
    goal: 'Test goal',
    ...overrides,
  }
}

function makeCheckIn(clientId, submittedDaysAgo, energy, weekNumber = 1) {
  return {
    client_id: clientId,
    submitted_at: daysAgo(submittedDaysAgo),
    energy,
    week_number: weekNumber,
    sleep_hrs: 7,
  }
}

// ─────────────────────────────────────────────
// Test 1: Client with no check-ins (>2 expected by account age)
// Account age = 60 days → expectedCheckIns = 8, so "few check-ins" applies too
// Score: 40 (no check-in) + 20 (few check-ins) = 60 → 'high'
// ─────────────────────────────────────────────
console.log('\nTest 1: No check-ins (>2 expected by age)')
{
  const client = makeClient() // 60 days old → expected = 8
  const result = computeChurnRisk(client, [])
  assert('score >= 40', result.score >= 40, `score=${result.score}`)
  assert('level is high', result.level === 'high', `level=${result.level}`)
  assert('reason: never checked in', result.reasons.includes('Nog nooit ingecheckt'))
  assert('daysSinceCheckIn is null', result.daysSinceCheckIn === null)
}

// ─────────────────────────────────────────────
// Test 2: Declining energy trend (check-ins: newest=4, middle=6, oldest=8)
// Sorted newest-first: e1=4, e2=6, e3=8 → e1 < e2 < e3 → declining trend
// Client is 30 days old, provide 3 check-ins → expectedCheckIns=4, actual=3
// 3 < 4*0.4=1.6? No → no "few check-ins" penalty
// Score: 0 (check-in 2 days ago) + 25 (declining trend) = 25 → 'medium'
// ─────────────────────────────────────────────
console.log('\nTest 2: Declining energy trend (8→6→4)')
{
  const client = makeClient({ created_at: daysAgo(30) })
  const checkIns = [
    makeCheckIn('client-1', 14, 4, 3), // newest (14 days ago), energy=4
    makeCheckIn('client-1', 21, 6, 2), // middle (21 days ago), energy=6
    makeCheckIn('client-1', 28, 8, 1), // oldest (28 days ago), energy=8
  ]
  const result = computeChurnRisk(client, checkIns)
  assert('declining trend detected', result.reasons.includes('Dalende energietrend'), `reasons=${JSON.stringify(result.reasons)}`)
  assert('score includes +25 for trend', result.score >= 25, `score=${result.score}`)
  // 14 days ago → daysSinceCheckIn=14 → >10 → +20 for late check-in
  // Total: 20 + 25 = 45 → medium
  assert('level is medium or high', result.level === 'medium' || result.level === 'high', `level=${result.level}`)
}

// ─────────────────────────────────────────────
// Test 3: Low energy but not declining (single check-in energy=3)
// Score: 0 (fresh check-in) + 15 (low energy) + potential few-checkins
// Client 60 days old → expected=8, actual=1 → 1 < 8*0.4=3.2 → +20
// Total: 15 + 20 = 35 → 'medium'
// ─────────────────────────────────────────────
console.log('\nTest 3: Low energy, single check-in (energy=3)')
{
  const client = makeClient()
  const checkIns = [makeCheckIn('client-1', 1, 3)]
  const result = computeChurnRisk(client, checkIns)
  assert('low energy reason present', result.reasons.includes('Lage energie bij laatste check-in'), `reasons=${JSON.stringify(result.reasons)}`)
  assert('score >= 15', result.score >= 15, `score=${result.score}`)
  assert('level is medium (low energy + few check-ins)', result.level === 'medium', `level=${result.level}`)
  assert('daysSinceCheckIn is 1', result.daysSinceCheckIn === 1, `daysSinceCheckIn=${result.daysSinceCheckIn}`)
}

// ─────────────────────────────────────────────
// Test 4: Old last check-in (22 days ago)
// Score: +40 (>21 days) + potential few-checkins
// ─────────────────────────────────────────────
console.log('\nTest 4: Old last check-in (22 days ago)')
{
  const client = makeClient()
  const checkIns = [makeCheckIn('client-1', 22, 7)]
  const result = computeChurnRisk(client, checkIns)
  assert('days reason present (>21)', result.reasons.some(r => r.includes('dagen geen check-in')), `reasons=${JSON.stringify(result.reasons)}`)
  assert('score includes +40 for >21 days', result.score >= 40, `score=${result.score}`)
  assert('level is high', result.level === 'high', `level=${result.level}`)
  assert('daysSinceCheckIn is 22', result.daysSinceCheckIn === 22, `daysSinceCheckIn=${result.daysSinceCheckIn}`)
}

// ─────────────────────────────────────────────
// Test 5: Moderately old check-in (12 days ago)
// Score: +20 (>10 days) — fresh enough to avoid >21 penalty
// ─────────────────────────────────────────────
console.log('\nTest 5: Moderately old check-in (12 days ago)')
{
  const client = makeClient()
  const checkIns = [
    makeCheckIn('client-1', 12, 7, 3),
    makeCheckIn('client-1', 19, 7, 2),
    makeCheckIn('client-1', 26, 7, 1),
  ]
  // 3 check-ins, client 60 days old → expected=8, actual=3 → 3 < 3.2 → +20 few check-ins
  // Score: 20 (days) + 20 (few check-ins) = 40 → medium
  const result = computeChurnRisk(client, checkIns)
  assert('score includes +20 for >10 days', result.score >= 20, `score=${result.score}`)
  assert('>10 day reason present', result.reasons.some(r => r.includes('dagen geen check-in')), `reasons=${JSON.stringify(result.reasons)}`)
  // Should NOT have the >21 penalty
  assert('score < 60 (no >21 day penalty)', result.score < 60, `score=${result.score}`)
  assert('daysSinceCheckIn is 12', result.daysSinceCheckIn === 12, `daysSinceCheckIn=${result.daysSinceCheckIn}`)
}

// ─────────────────────────────────────────────
// Test 6: Fresh check-in (2 days ago), good energy, many check-ins → 'low' risk
// Client 56 days old → expected = 8. Provide 10 check-ins → 10 >= 8*0.4=3.2 → no few check-ins penalty
// Energy=8 → no low energy
// daysSince=2 → no days penalty
// Status=actief → no status penalty
// Score: 0 → 'low'
// ─────────────────────────────────────────────
console.log('\nTest 6: Fresh check-in, good energy, many check-ins → low risk')
{
  const client = makeClient({ created_at: daysAgo(56) })
  const checkIns = Array.from({ length: 10 }, (_, i) =>
    makeCheckIn('client-1', 2 + i * 5, 8, 10 - i)
  )
  const result = computeChurnRisk(client, checkIns)
  assert('score is 0', result.score === 0, `score=${result.score}`)
  assert('level is low', result.level === 'low', `level=${result.level}`)
  assert('no reasons', result.reasons.length === 0, `reasons=${JSON.stringify(result.reasons)}`)
  assert('daysSinceCheckIn is 2', result.daysSinceCheckIn === 2, `daysSinceCheckIn=${result.daysSinceCheckIn}`)
}

// ─────────────────────────────────────────────
// Test 7: Client with status 'inactief'
// Score: +15 (status) — with fresh check-in and good energy
// Client 14 days old → expected=2 → expectedCheckIns NOT > 2 → no few check-ins penalty
// Score: 15 → 'medium' (15 < 25... wait: 15 < 25 → 'low'? No: score>=25 → medium)
// 15 < 25 → 'low'. But we want to verify the status reason is there.
// ─────────────────────────────────────────────
console.log('\nTest 7: Client with status "inactief"')
{
  const client = makeClient({ status: 'inactief', created_at: daysAgo(14) })
  const checkIns = [makeCheckIn('client-1', 1, 7)]
  const result = computeChurnRisk(client, checkIns)
  assert('status reason present', result.reasons.includes('Status: inactief'), `reasons=${JSON.stringify(result.reasons)}`)
  assert('score includes +15 for inactief', result.score >= 15, `score=${result.score}`)
  // 14 days old → expected=2, NOT > 2 → no few check-ins penalty
  // Score: 0 (fresh) + 0 (energy ok) + 0 (few check-ins not triggered) + 15 (inactief) = 15
  // 15 < 25 → 'low'
  assert('level is low (score=15 < 25)', result.level === 'low', `level=${result.level}`)
}

// ─────────────────────────────────────────────
// Test 7b: inactief client with older account age triggers 'medium'
// Client 60 days old, 1 check-in → expected=8, actual=1 → 1 < 3.2 → +20 few check-ins
// Score: 0 + 0 + 20 + 15 = 35 → 'medium'
// ─────────────────────────────────────────────
console.log('\nTest 7b: "inactief" client with old account → medium risk')
{
  const client = makeClient({ status: 'inactief' }) // 60 days old
  const checkIns = [makeCheckIn('client-1', 1, 7)]
  const result = computeChurnRisk(client, checkIns)
  assert('status reason present', result.reasons.includes('Status: inactief'), `reasons=${JSON.stringify(result.reasons)}`)
  assert('few check-ins reason present', result.reasons.includes('Weinig check-ins vergeleken met inschrijfduur'), `reasons=${JSON.stringify(result.reasons)}`)
  assert('level is medium', result.level === 'medium', `level=${result.level}`)
}

// ─────────────────────────────────────────────
// Test 8: Very few check-ins relative to account age
// Client 84 days old → expected = 12. Provide 2 check-ins → 2 < 12*0.4=4.8 → +20
// No other penalties (fresh check-in, good energy)
// Score: 20 → 'medium'
// ─────────────────────────────────────────────
console.log('\nTest 8: Very few check-ins relative to account age')
{
  const client = makeClient({ created_at: daysAgo(84) })
  const checkIns = [
    makeCheckIn('client-1', 1, 7, 2),
    makeCheckIn('client-1', 8, 7, 1),
  ]
  const result = computeChurnRisk(client, checkIns)
  assert('few check-ins reason present', result.reasons.includes('Weinig check-ins vergeleken met inschrijfduur'), `reasons=${JSON.stringify(result.reasons)}`)
  assert('score is 20', result.score === 20, `score=${result.score}`)
  // score=20 is below the medium threshold (25), so level is 'low'
  // The few-check-ins penalty alone (20 pts) is not enough to reach medium
  assert('level is low (score=20 < 25 threshold)', result.level === 'low', `level=${result.level}`)
}

// ─────────────────────────────────────────────
// Test 9: Score capped at 100
// Worst case: no check-ins (40) + inactief (15) + few check-ins (20) = 75 already < 100
// Force all penalties: >21 days (40) + declining trend (25) + few check-ins (20) + inactief (15) = 100
// ─────────────────────────────────────────────
console.log('\nTest 9: Score capped at 100')
{
  const client = makeClient({ status: 'inactief', created_at: daysAgo(84) })
  // 3 declining check-ins, all >21 days old
  const checkIns = [
    makeCheckIn('client-1', 30, 3, 3), // newest energy=3
    makeCheckIn('client-1', 37, 6, 2), // middle energy=6
    makeCheckIn('client-1', 44, 8, 1), // oldest energy=8
  ]
  // daysSince = 30 → >21 → +40
  // declining: e1=3 < e2=6 < e3=8 → +25
  // 84 days → expected=12, actual=3 → 3 < 4.8 → +20
  // inactief → +15
  // Total: 40+25+20+15 = 100 → capped at 100
  const result = computeChurnRisk(client, checkIns)
  assert('score is exactly 100', result.score === 100, `score=${result.score}`)
  assert('level is high', result.level === 'high', `level=${result.level}`)
}

// ─────────────────────────────────────────────
// Test 10: expectedCheckIns boundary — exactly 2 (no penalty)
// Client exactly 14 days old → expected = 2 → NOT > 2 → no few check-ins penalty
// ─────────────────────────────────────────────
console.log('\nTest 10: expectedCheckIns boundary (exactly 2, no penalty)')
{
  const client = makeClient({ created_at: daysAgo(14) })
  const checkIns = [makeCheckIn('client-1', 1, 7)]
  const result = computeChurnRisk(client, checkIns)
  assert('no few check-ins reason', !result.reasons.includes('Weinig check-ins vergeleken met inschrijfduur'), `reasons=${JSON.stringify(result.reasons)}`)
}

// ─────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`)
if (failed === 0) {
  console.log('All tests PASSED.')
} else {
  console.log(`${failed} test(s) FAILED.`)
  process.exit(1)
}
