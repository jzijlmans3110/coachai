import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)
    const paymentId = params.get('id')

    if (!paymentId) {
      return new Response('missing id', { status: 400 })
    }

    const mollieKey = Deno.env.get('MOLLIE_API_KEY')!

    // Fetch payment from Mollie to verify
    const res = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mollieKey}` },
    })
    const payment = await res.json()

    if (payment.status !== 'paid') {
      return new Response('not paid', { status: 200 })
    }

    const userId = payment.metadata?.supabase_user_id
    if (!userId) {
      return new Response('no user id', { status: 200 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Upgrade coach to pro
    await supabase
      .from('coaches')
      .update({ plan: 'pro' })
      .eq('id', userId)

    // Create recurring subscription using the mandate
    if (payment.mandateId) {
      await fetch(`https://api.mollie.com/v2/customers/${payment.customerId}/subscriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mollieKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: { currency: 'EUR', value: '49.00' },
          interval: '1 month',
          description: 'CoachAI Pro — monthly subscription',
          mandateId: payment.mandateId,
          webhookUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mollie-webhook`,
          metadata: { supabase_user_id: userId },
        }),
      })
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('error', { status: 500 })
  }
})
