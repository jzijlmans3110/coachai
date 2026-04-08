import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (data: unknown) => new Response(JSON.stringify(data), {
  status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { program_id, client_id, coach_id } = await req.json()
    if (!program_id || !client_id) return json({ error: 'program_id en client_id zijn verplicht' })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const [{ data: program }, { data: client }, { data: checkIns }] = await Promise.all([
      supabase.from('programs').select('*').eq('id', program_id).single(),
      supabase.from('clients').select('*').eq('id', client_id).single(),
      supabase.from('check_ins').select('*').eq('client_id', client_id).order('submitted_at', { ascending: false }).limit(8),
    ])

    if (!program || !client) return json({ error: 'Programma of client niet gevonden' })

    const checkInSummary = (checkIns ?? []).map(c =>
      `Week ${c.week_number}: energie ${c.energy}/10, gewicht ${c.weight_kg ?? '?'}kg, slaap ${c.sleep_hrs ?? '?'}u${c.notes ? `, "${c.notes}"` : ''}`
    ).join('\n') || 'Geen check-ins beschikbaar'

    const prompt = `Je bent een expert personal trainer. Pas dit trainingsprogramma aan op basis van de recente check-ins van de client.

CLIENT:
Naam: ${client.full_name}, Doel: ${client.goal}, Niveau: ${client.level}
Blessures: ${client.injuries || 'geen'}

RECENTE CHECK-INS:
${checkInSummary}

HUIDIG PROGRAMMA TITEL: ${program.title}

Genereer een aangepast programma in exact hetzelfde JSON-formaat als het origineel:
{
  "title": "...",
  "weeks": [{ "week": 1, "days": [{ "day": "Maandag", "focus": "...", "exercises": [{ "name": "...", "sets": 4, "reps": "8-10", "rest": "90s", "notes": "" }] }] }]
}

Pas intensiteit, volume en oefeningen aan op basis van de check-in data. Antwoord met JSON only.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system: 'Je bent een expert personal trainer. Antwoord altijd met valide JSON only, geen markdown.',
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return json({ error: `Claude fout: ${await res.text()}` })

    const aiData = await res.json()
    let raw = aiData.content?.[0]?.text ?? '{}'
    raw = raw.replace(/```(?:json)?/g, '').trim()
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}')
    if (s !== -1 && e !== -1) raw = raw.slice(s, e + 1)

    let programContent
    try { programContent = JSON.parse(raw) }
    catch { return json({ error: 'Parse fout bij aangepast programma' }) }

    // Save as new program
    const { data: newProgram, error: insertError } = await supabase
      .from('programs')
      .insert({
        client_id,
        coach_id: coach_id ?? program.coach_id,
        title: programContent.title ?? 'Aangepast programma',
        weeks: program.weeks,
        content: programContent,
        ai_generated: true,
      })
      .select().single()

    if (insertError) return json({ error: `DB fout: ${insertError.message}` })

    return json({ program: newProgram })
  } catch (err) {
    return json({ error: String(err) })
  }
})
