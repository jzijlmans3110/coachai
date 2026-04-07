import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { client_id, coach_id } = await req.json()

    if (!client_id || !coach_id) {
      return new Response(JSON.stringify({ error: 'client_id and coach_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .eq('coach_id', coach_id)
      .single()

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: 'Client not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const weeks = 4
    const userMessage = `Create a ${weeks}-week program for:
Goal: ${client.goal}
Level: ${client.level}
Days/week: ${client.days_per_week}
Equipment: ${client.equipment?.join(', ') || 'bodyweight'}
Injuries: ${client.injuries || 'none'}`

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
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
      console.error('Claude API error:', err)
      return new Response(JSON.stringify({ error: 'AI generation failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const claudeData = await claudeResponse.json()
    const rawContent = claudeData.content?.[0]?.text ?? ''

    let programContent
    try {
      programContent = JSON.parse(rawContent)
    } catch {
      console.error('Failed to parse Claude response:', rawContent)
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Save to database
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
      console.error('DB insert error:', insertError)
      return new Response(JSON.stringify({ error: 'Failed to save program' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ program }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
