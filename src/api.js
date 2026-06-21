// Thin client for the clipper backend (proxied via Vite to :8000).

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
  return asJson(await fetch(`/api/clips${q}`))
}

// Topic -> tailored flashcard questions (or a clarification prompt).
export async function getQuestionnaire(topic) {
  return asJson(
    await fetch('/api/questionnaire', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic }),
    }),
  )
}

// One class box -> { specific, message, suggestions } (vagueness gate only).
export async function checkTopic(topic) {
  return asJson(
    await fetch('/api/check-topic', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
    await fetch('/api/learn', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}

export async function createJob(url) {
  return asJson(
    await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    }),
  )
}

export async function getJob(jobId) {
  return asJson(await fetch(`/api/jobs/${jobId}`))
}

export async function searchTopic(query) {
  return asJson(
    await fetch('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    }),
  )
}

export async function uploadVideo(file) {
  const fd = new FormData()
  fd.append('file', file)
  return asJson(await fetch('/api/upload', { method: 'POST', body: fd }))
}
