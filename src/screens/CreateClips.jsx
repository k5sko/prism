import { useEffect, useRef, useState } from 'react'
import { createJob, getJob, searchTopic, uploadVideo } from '../api.js'
import JobProgress from '../components/JobProgress.jsx'

// Screen 1 — three ways in: search a topic (finds a vetted-channel video),
// paste a YouTube link, or upload an MP4. A stepped progress bar shows exactly
// what the pipeline is doing and which stage failed.
const MODES = [
  { id: 'topic', label: 'Topic' },
  { id: 'youtube', label: 'YouTube link' },
  { id: 'upload', label: 'Upload MP4' },
]

export default function CreateClips({ libraryCount = 0, onDone, onBrowse }) {
  const [mode, setMode] = useState('topic')
  const [topic, setTopic] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState(null)

  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState(null)
  const [jobStarted, setJobStarted] = useState(false)
  const [error, setError] = useState(null)
  const [clarify, setClarify] = useState(null) // {message, suggestions}
  const [foundList, setFoundList] = useState([]) // videos being parsed (topic search)
  const cancelled = useRef(false)

  useEffect(() => {
    // Reset on (re)mount so React StrictMode's mount→unmount→remount in dev
    // doesn't leave the flag stuck true and freeze polling.
    cancelled.current = false
    return () => {
      cancelled.current = true
    }
  }, [])
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  const reset = () => {
    setError(null)
    setClarify(null)
    setFoundList([])
    setJobStarted(false)
    setStage(null)
    setBusy(true)
  }
  const stop = () => setBusy(false)

  const pollJob = async (jobId) => {
    setStage('queued')
    while (!cancelled.current) {
      await sleep(2000)
      const job = await getJob(jobId)
      if (job.status === 'done') {
        setStage('done')
        if (!cancelled.current) await onDone(jobId)
        return
      }
      if (job.status === 'error') {
        setError(job.error || 'The job failed.') // keep last live stage so it shows as failed
        return stop()
      }
      setStage(job.status)
    }
  }

  // Poll several jobs in parallel (a topic search parses 2 videos). The progress
  // bar shows the least-progressed job; finishes when all are terminal.
  const STAGE_ORDER = ['searching', 'uploading', 'queued', 'ingesting', 'transcribing', 'segmenting', 'labeling', 'done']
  const pollJobs = async (jobIds) => {
    setStage('queued')
    while (!cancelled.current) {
      await sleep(2000)
      let jobs
      try {
        jobs = await Promise.all(jobIds.map(getJob))
      } catch (e) {
        setError(String(e.message || e))
        return stop()
      }
      const terminal = jobs.filter((j) => j.status === 'done' || j.status === 'error')
      if (terminal.length === jobs.length) {
        const okIds = jobs.filter((j) => j.status === 'done').map((j) => j.job_id)
        if (okIds.length === 0) {
          setError(jobs.find((j) => j.error)?.error || 'All videos failed.')
          return stop()
        }
        setStage('done')
        if (!cancelled.current) await onDone(okIds)
        return
      }
      const nonDone = jobs.filter((j) => j.status !== 'done')
      let laggard = nonDone[0].status
      for (const j of nonDone) {
        if (STAGE_ORDER.indexOf(j.status) < STAGE_ORDER.indexOf(laggard)) laggard = j.status
      }
      setStage(laggard)
    }
  }

  const runTopic = async (override) => {
    const q = (override ?? topic).trim()
    if (!q || busy) return
    if (override) setTopic(override)
    reset()
    setStage('searching')
    try {
      const r = await searchTopic(q)
      if (r.status === 'needs_clarification') {
        setClarify({ message: r.message, suggestions: r.suggestions || [] })
        return stop()
      }
      if (r.status !== 'found') {
        setError(r.message || 'No matching video found.')
        return stop()
      }
      const jobs = r.jobs || []
      setFoundList(jobs.map((j) => j.video))
      setJobStarted(true)
      await pollJobs(jobs.map((j) => j.job_id))
    } catch (e) {
      setError(String(e.message || e))
      stop()
    }
  }

  const runUrl = async () => {
    const u = url.trim()
    if (!u || busy) return
    reset()
    setStage('queued')
    try {
      const { job_id } = await createJob(u)
      setJobStarted(true)
      await pollJob(job_id)
    } catch (e) {
      setError(String(e.message || e))
      stop()
    }
  }

  const runUpload = async () => {
    if (!file || busy) return
    reset()
    setStage('uploading')
    try {
      const { job_id } = await uploadVideo(file)
      setJobStarted(true)
      await pollJob(job_id)
    } catch (e) {
      setError(String(e.message || e))
      stop()
    }
  }

  const keyHint =
    error && /api_key|x-api-key|authentication|401|ANTHROPIC|GROQ/i.test(error)
      ? 'An API key may be missing/invalid — check ANTHROPIC_API_KEY (and GROQ_API_KEY if using Groq) in clipper/.env, then restart the backend.'
      : null

  const showProgress = busy || (error && jobStarted)

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
        <div className="animate-blob absolute -left-12 -top-16 h-48 w-48 rounded-full bg-blue-400 opacity-40 blur-3xl" />
        <div className="animate-blob absolute right-0 -top-10 h-44 w-44 rounded-full bg-purple-400 opacity-40 blur-3xl" style={{ animationDelay: '1.5s' }} />
        <div className="animate-blob absolute left-24 top-2 h-40 w-40 rounded-full bg-amber-400 opacity-30 blur-3xl" style={{ animationDelay: '3s' }} />
      </div>

      <div className="relative flex h-full flex-col px-5 pb-5 pt-9">
        <header className="mb-6">
          <p className="mb-2 font-mono text-[13px] text-gray-900">Reel Learning</p>
          <h1 className="text-[34px] font-semibold leading-[40px] tracking-[-1.4px] text-gray-1000">
            Learn anything,
            <br />as a feed of clips.
          </h1>
        </header>

        {/* mode tabs */}
        <div className="mb-4 flex gap-1 rounded-md bg-gray-100 p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => !busy && setMode(m.id)}
              disabled={busy}
              className={`h-9 flex-1 rounded-sm text-[13px] font-medium transition-colors duration-150 ease-geist disabled:opacity-50 ${
                mode === m.id ? 'bg-bg-100 text-gray-1000 shadow-raised' : 'text-gray-900 hover:text-gray-1000'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* TOPIC */}
        {mode === 'topic' && (
          <>
            <div className="flex gap-2">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runTopic()}
                placeholder="What do you want to learn? e.g. the chain rule"
                disabled={busy}
                className="h-12 flex-1 rounded-sm border border-gray-a-400 bg-bg-100 px-3 text-[16px] leading-5 text-gray-1000 shadow-raised placeholder:text-gray-700 disabled:bg-gray-100"
              />
              <button
                onClick={() => runTopic()}
                disabled={!topic.trim() || busy}
                className="h-12 rounded-sm bg-gray-1000 px-4 text-[16px] font-medium text-bg-100 transition-colors duration-150 ease-geist hover:bg-gray-900 disabled:bg-gray-100 disabled:text-gray-700"
              >
                Find
              </button>
            </div>
            <p className="mt-2 text-[12px] leading-4 text-gray-700">
              Searches pre-vetted channels for a focused video, then clips it.
            </p>
          </>
        )}

        {/* YOUTUBE */}
        {mode === 'youtube' && (
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runUrl()}
              placeholder="https://youtube.com/watch?v=…"
              disabled={busy}
              className="h-12 flex-1 rounded-sm border border-gray-a-400 bg-bg-100 px-3 text-[16px] leading-5 text-gray-1000 shadow-raised placeholder:text-gray-700 disabled:bg-gray-100"
            />
            <button
              onClick={runUrl}
              disabled={!url.trim() || busy}
              className="h-12 rounded-sm bg-gray-1000 px-4 text-[16px] font-medium text-bg-100 transition-colors duration-150 ease-geist hover:bg-gray-900 disabled:bg-gray-100 disabled:text-gray-700"
            >
              Generate
            </button>
          </div>
        )}

        {/* UPLOAD */}
        {mode === 'upload' && (
          <div className="flex flex-col gap-2">
            <label className="flex h-24 cursor-pointer items-center justify-center rounded-md border border-dashed border-gray-a-400 bg-bg-100 text-center text-[14px] text-gray-900 hover:bg-gray-100">
              <input
                type="file"
                accept="video/mp4,video/*"
                disabled={busy}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              {file ? `Selected: ${file.name}` : 'Choose an MP4 file…'}
            </label>
            <button
              onClick={runUpload}
              disabled={!file || busy}
              className="h-12 rounded-sm bg-gray-1000 px-4 text-[16px] font-medium text-bg-100 transition-colors duration-150 ease-geist hover:bg-gray-900 disabled:bg-gray-100 disabled:text-gray-700"
            >
              Generate
            </button>
          </div>
        )}

        {/* status area */}
        <div className="mt-5 flex-1 overflow-y-auto no-scrollbar">
          {foundList.length > 0 && (
            <p className="mb-3 text-[13px] leading-5 text-gray-900">
              Parsing {foundList.length} video{foundList.length === 1 ? '' : 's'}:{' '}
              <span className="text-gray-1000">
                {foundList.map((v) => `“${v.title}”`).join(' · ')}
              </span>
            </p>
          )}

          {showProgress && (
            <>
              <JobProgress mode={mode} stage={stage} error={error && jobStarted ? error : null} />
              {error && jobStarted && (
                <div className="mt-3 rounded-md border border-red-400 bg-red-100 p-3">
                  <p className="break-words text-[13px] leading-5 text-red-900/90">{error}</p>
                  {keyHint && <p className="mt-1.5 text-[13px] leading-5 text-red-900/90">{keyHint}</p>}
                </div>
              )}
            </>
          )}

          {clarify && (
            <div className="rounded-md border border-amber-400 bg-amber-100 p-4">
              <p className="text-[14px] leading-5 text-amber-900">{clarify.message}</p>
              {clarify.suggestions.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {clarify.suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => runTopic(s)}
                      className="rounded-full border border-amber-600/40 bg-bg-100 px-3 py-1 text-[13px] text-amber-900 transition-colors duration-150 ease-geist hover:bg-amber-100"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && !jobStarted && (
            <div className="rounded-md border border-red-400 bg-red-100 p-4">
              <p className="text-[14px] font-medium text-red-900">Couldn’t start</p>
              <p className="mt-1 break-words text-[13px] leading-5 text-red-900/90">{error}</p>
              {keyHint && <p className="mt-2 text-[13px] leading-5 text-red-900/90">{keyHint}</p>}
            </div>
          )}
        </div>

        {libraryCount > 0 && !busy && (
          <button
            onClick={onBrowse}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-gray-a-400 bg-bg-100 text-[16px] font-medium text-gray-1000 transition-colors duration-150 ease-geist hover:bg-gray-100"
          >
            Browse library
            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[12px] text-gray-900">
              {libraryCount}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
