import http from 'node:http'

const PORT = Number(process.env.AI_PORT ?? 8787)
const HOST = '127.0.0.1'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  response.end(JSON.stringify(payload))
}

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf-8')
  if (!raw) {
    return {}
  }
  return JSON.parse(raw)
}

async function callOpenAIJSON(systemPrompt, userPrompt) {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY in local environment.')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('OpenAI returned empty content.')
  }

  return JSON.parse(content)
}

async function handleDraftMemo(request, response) {
  const body = await readBody(request)
  const systemPrompt =
    'You are an executive memo assistant. Return strict JSON only. Keep responses concise and decision-oriented.'
  const userPrompt = JSON.stringify({
    task: 'Draft structured memo sections and workflow suggestions',
    required_output_shape: {
      background: 'string',
      analysis: 'string',
      recommendation: 'string',
      suggested_priority: 'High|Medium|Low',
      suggested_approver_count: 'number 1-4',
      include_final_authority: 'boolean',
      external_implication: 'boolean',
      institutional_implication: 'boolean',
      attachment_hint: 'string',
    },
    input: body,
  })

  const drafted = await callOpenAIJSON(systemPrompt, userPrompt)
  sendJson(response, 200, drafted)
}

async function handleSnapshot(request, response) {
  const body = await readBody(request)
  const systemPrompt =
    'You are an executive approval briefer. Return strict JSON only. Focus on decision-ready summary.'
  const userPrompt = JSON.stringify({
    task: 'Create an approver snapshot',
    required_output_shape: {
      snapshot: 'string <= 80 words',
      top_risks: ['string', 'string', 'string'],
      decision_prompt: 'string <= 20 words',
    },
    input: body,
  })

  const summary = await callOpenAIJSON(systemPrompt, userPrompt)
  sendJson(response, 200, summary)
}

const server = http.createServer(async (request, response) => {
  try {
    if (!request.url) {
      sendJson(response, 400, { error: 'Invalid request URL.' })
      return
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      response.end()
      return
    }

    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, {
        ok: true,
        localOnly: true,
        model: OPENAI_MODEL,
        hasApiKey: Boolean(OPENAI_API_KEY),
      })
      return
    }

    if (request.method === 'POST' && request.url === '/api/ai/draft-memo') {
      await handleDraftMemo(request, response)
      return
    }

    if (request.method === 'POST' && request.url === '/api/ai/snapshot') {
      await handleSnapshot(request, response)
      return
    }

    sendJson(response, 404, { error: 'Route not found.' })
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Unknown server error.',
    })
  }
})

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Local AI server running at http://${HOST}:${PORT}`)
})
