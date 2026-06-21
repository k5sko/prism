import { useEffect, useState } from 'react'
import { listClips } from '../api.js'
import { getGraph } from '../lib/memoryApi.js'
import { decorateClip } from '../lib/clips.js'

// Progress tab — the design bundle's 5th tab. Real numbers only: everything here
// is derived from existing app state (the clip library + the memory graph), no
// invented mastery scores.
export default function Progress({ onBrowse }) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [clipsRes, graph] = await Promise.all([
          listClips(),
          getGraph().catch(() => ({ meta: {}, nodes: [], lessons: [] })),
        ])
        if (!alive) return
        const decorated = (clipsRes.clips || []).map(decorateClip)
        const subjects = [...new Set(decorated.map((c) => c.subjectTag))]
        const videos = new Set(decorated.map((c) => c.jobId).filter(Boolean))
        setStats({
          clips: decorated.length,
          subjects,
          videos: videos.size,
          memoryPoints: graph.meta?.nodeCount ?? graph.nodes?.length ?? 0,
          lessons: graph.meta?.lessonCount ?? graph.lessons?.length ?? 0,
        })
      } catch (e) {
        if (alive) setError(String(e.message || e))
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const cards = stats
    ? [
        { n: stats.clips, label: 'Clips in library' },
        { n: stats.subjects.length, label: 'Subjects' },
        { n: stats.memoryPoints, label: 'Memory points' },
        { n: stats.lessons, label: 'Lessons committed' },
      ]
    : []

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-6 pb-8 pt-12">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-gray-700">Your progress</p>
      <h1 className="font-head mb-7 text-[30px] font-semibold leading-9 tracking-[-1px] text-gray-1000">
        What you’ve learned
      </h1>

      {error && (
        <div className="rounded-md border border-red-400 bg-red-100 p-4 text-[13px] leading-5 text-red-900/90">
          Couldn’t load progress. {error}
        </div>
      )}

      {!stats && !error && (
        <div className="flex items-center gap-3 rounded-md border border-gray-a-200 bg-bg-100 p-4 shadow-raised">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-1000" />
          <p className="text-[14px] font-medium text-gray-1000">Tallying your library…</p>
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {cards.map((c) => (
              <div
                key={c.label}
                className="rounded-lg border border-gray-a-200 bg-bg-100 p-4 shadow-raised"
              >
                <div className="font-head text-[34px] font-semibold leading-none tracking-[-1.2px] text-gray-1000 tabular-nums">
                  {c.n}
                </div>
                <div className="mt-2 text-[13px] leading-4 text-gray-700">{c.label}</div>
              </div>
            ))}
          </div>

          {stats.subjects.length > 0 && (
            <div className="mt-7">
              <p className="mb-2.5 text-[13px] font-medium text-gray-900">Subjects in your feed</p>
              <div className="flex flex-wrap gap-2">
                {stats.subjects.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-gray-a-200 bg-bg-100 px-3 py-1.5 text-[13px] font-medium text-gray-1000"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {stats.clips === 0 && (
            <button
              onClick={onBrowse}
              className="mt-7 h-12 w-full rounded-sm bg-gray-1000 text-[15px] font-medium text-bg-100 transition-colors duration-150 ease-geist hover:bg-gray-900"
            >
              Build your first feed
            </button>
          )}
        </>
      )}
    </div>
  )
}
