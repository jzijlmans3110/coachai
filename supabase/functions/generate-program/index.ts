import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { client_id, coach_id } = await req.json()

    if (!client_id || !coach_id) {
      return json({ error: 'client_id and coach_id are required' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!supabaseUrl || !serviceKey) return json({ error: 'Missing SUPABASE env vars' })
    if (!anthropicKey) return json({ error: 'Missing ANTHROPIC_API_KEY' })

    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .eq('coach_id', coach_id)
      .single()

    if (clientError || !client) {
      return json({ error: `Client not found: ${clientError?.message}` })
    }

    const weeks = 4
    const bmi = client.weight_kg && client.height_cm
      ? (client.weight_kg / Math.pow(client.height_cm / 100, 2)).toFixed(1)
      : null

    const userMessage = `Create a ${weeks}-week program for:
Goal: ${client.goal}
Level: ${client.level}
Days/week: ${client.days_per_week}
Equipment: ${client.equipment?.join(', ') || 'bodyweight'}
${client.gender ? `Gender: ${client.gender}` : ''}
${client.age ? `Age: ${client.age}` : ''}
${client.weight_kg ? `Weight: ${client.weight_kg} kg` : ''}
${client.height_cm ? `Height: ${client.height_cm} cm` : ''}
${bmi ? `BMI: ${bmi}` : ''}
${client.experience_years != null ? `Training experience: ${client.experience_years} years` : ''}
${client.training_time ? `Preferred training time: ${client.training_time}` : ''}
Injuries/limitations: ${client.injuries || 'none'}
${client.medical_notes ? `Medical notes: ${client.medical_notes}` : ''}`

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system: `You are an expert personal trainer. Always respond with valid JSON only, no markdown, no explanation.
Format:
{
  "title": "4-Week Strength Program",
  "weeks": [
    {
      "week": 1,
      "days": [
        {
          "day": "Monday",
          "focus": "Push",
          "exercises": [
            { "name": "Bench Press", "sets": 4, "reps": "8-10", "rest": "90s", "notes": "" }
          ]
        }
      ]
    }
  ]
}`,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!claudeResponse.ok) {
      const err = await claudeResponse.text()
      return json({ error: `Claude API failed (${claudeResponse.status}): ${err}` })
    }

    const claudeData = await claudeResponse.json()
    const rawContent = claudeData.content?.[0]?.text ?? ''

    // Strip markdown and extract JSON — v10
    let cleaned = rawContent.trim()
    cleaned = cleaned.replace(/^```(?:json)?[\r\n]*/m, '').replace(/[\r\n]*```\s*$/m, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1)

    let programContent
    try {
      programContent = JSON.parse(cleaned)
    } catch (e) {
      return json({ error: `v10 parse error: ${String(e)} | raw[:100]: ${rawContent.slice(0, 100)}` })
    }

    const { data: program, error: insertError } = await supabase
      .from('programs')
      .insert({
        client_id,
        coach_id,
        title: programContent.title ?? '4-Week Program',
        weeks,
        content: programContent,
        ai_generated: true,
      })
      .select()
      .single()

    if (insertError) {
      return json({ error: `DB insert failed: ${insertError.message}` })
    }

    return json({ program })
  } catch (err) {
    return json({ error: `Unexpected error: ${String(err)}` })
  }
})
