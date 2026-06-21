// Thin client for the clipper backend. Relative URLs go through the Vite dev
// server: /api/memory is served in-process, everything else proxies to the
// clipper on :8000. This keeps the whole app on a single origin — so one ngrok
// tunnel (to :5173) exposes frontend + both APIs with no mixed-content/CORS.
const BASE = import.meta.env.VITE_CLIPPER_API || ''

// Skip ngrok's free-tier browser-warning interstitial so fetches get JSON, not HTML.
const NG = { 'ngrok-skip-browser-warning': 'true' }
const u = (path) => `${BASE}${path}`

async function asJson(res) {
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body && body.detail) detail = body.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return res.json()
}

export async function listClips(jobId) {
  // jobId may be a single id, an array of ids (multi-video session), or null.
  const ids = Array.isArray(jobId) ? jobId.join(',') : jobId
  const q = ids ? `?job_id=${encodeURIComponent(ids)}` : ''
  return asJson(await fetch(u(`/api/clips${q}`), { headers: NG }))
}

// Aggregate transcript-compression savings (powers the "tokens saved" badge).
export async function getStats() {
  return asJson(await fetch(u('/api/stats'), { headers: NG }))
}

// Topic -> tailored flashcard questions (or a clarification prompt).
export async function getQuestionnaire(topic) {
  return asJson(
    await fetch(u('/api/questionnaire'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...NG },
      body: JSON.stringify({ topic }),
    }),
  )
}

// One class box -> { specific, message, suggestions } (vagueness gate only).
export async function checkTopic(topic) {
  return asJson(
    await fetch(u('/api/check-topic'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...NG },
      body: JSON.stringify({ topic }),
    }),
  )
}

// A class topic -> a multi-video learning plan + started clipping jobs.
// `maxVideos` lets the multi-class flow request fewer videos per class.
export async function startLearning(topic, answers = {}, maxVideos) {
  const payload = { topic, answers }
  if (maxVideos != null) payload.max_videos = maxVideos
  return asJson(
    await fetch(u('/api/learn'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...NG },
      body: JSON.stringify(payload),
    }),
  )
}

export async function createJob(url) {
  return asJson(
    await fetch(u('/api/jobs'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...NG },
      body: JSON.stringify({ url }),
    }),
  )
}

export async function getJob(jobId) {
  return asJson(await fetch(u(`/api/jobs/${jobId}`), { headers: NG }))
}

export async function searchTopic(query) {
  return asJson(
    await fetch(u('/api/search'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...NG },
      body: JSON.stringify({ query }),
    }),
  )
}

export async function uploadVideo(file) {
  const fd = new FormData()
  fd.append('file', file)
  return asJson(await fetch(u('/api/upload'), { method: 'POST', headers: NG, body: fd }))
}
