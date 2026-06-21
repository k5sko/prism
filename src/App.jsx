import { useCallback, useEffect, useRef, useState } from 'react'
import { listClips } from './api.js'
import { decorateClip } from './lib/clips.js'
import { saveLesson } from './lib/memoryApi.js'
import CreateClips from './screens/CreateClips.jsx'
import Feed from './screens/Feed.jsx'
import ClipPlayer from './screens/ClipPlayer.jsx'
import MemoryGraph from './screens/MemoryGraph.jsx'
import Progress from './screens/Progress.jsx'
import TabBar from './components/TabBar.jsx'
import Toast from './components/Toast.jsx'

// Empty state for the Watch tab when no clip is selected yet.
function WatchEmpty({ onGoFeed }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-bg-100 px-8 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full border border-gray-a-200 text-gray-700">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M8 5.5v13l11-6.5L8 5.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="text-[15px] leading-6 text-gray-900">
        Nothing playing yet.
        <br />Pick a clip from your feed to watch.
      </p>
      <button
        onClick={onGoFeed}
        className="h-10 rounded-sm bg-gray-1000 px-4 text-[14px] font-medium text-bg-100 transition-colors duration-150 ease-geist hover:bg-gray-900"
      >
        Go to For You
      </button>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('learn') // learn | foryou | watch | progress | map
  const [clips, setClips] = useState([])
  const [libraryCount, setLibraryCount] = useState(0)
  const [scoped, setScoped] = useState(false) // feed showing one topic vs whole library
  const [playerIndex, setPlayerIndex] = useState(0)
  const [toast, setToast] = useState(null)
  const [graphRefresh, setGraphRefresh] = useState(0)
  const [highlightIds, setHighlightIds] = useState([])
  const returnTab = useRef('foryou') // where the Map tab's close button returns to

  const loadCount = useCallback(async () => {
    try {
      const { clips: all } = await listClips()
      setLibraryCount(all.length)
    } catch {
      setLibraryCount(0)
    }
  }, [])

  useEffect(() => {
    loadCount()
  }, [loadCount])

  // Load the feed scoped to one job (a topic) or the whole library (jobId=null),
  // and land on the For You tab.
  const showFeed = async (jobId) => {
    try {
      const { clips: raw } = await listClips(jobId)
      setClips(raw.map(decorateClip))
    } catch {
      setClips([])
    }
    setScoped(!!jobId)
    setPlayerIndex(0)
    setTab('foryou')
  }

  const openPlayer = (i) => {
    setPlayerIndex(i)
    setTab('watch')
  }
  const navigate = (delta) => {
    setPlayerIndex((i) => Math.min(Math.max(i + delta, 0), clips.length - 1))
  }

  const openGraph = useCallback(() => {
    setTab((cur) => {
      if (cur !== 'map') returnTab.current = cur
      return 'map'
    })
  }, [])

  // Bottom-bar tab selection. "For You" lazy-loads the whole library the first
  // time if no session feed is loaded yet; "Map" remembers where to return.
  const selectTab = useCallback(
    async (t) => {
      if (t === 'foryou' && clips.length === 0) {
        await showFeed(null)
        return
      }
      if (t === 'map') {
        openGraph()
        return
      }
      setTab(t)
    },
    [clips.length, openGraph],
  )

  // Save a watched clip as a lesson -> kicks off the memory pipeline (Claude
  // extracts memory points, Redis recalls related ones, connections persisted).
  const handleSaveLesson = useCallback(
    async (clip) => {
      const result = await saveLesson({
        title: clip.title,
        subject: clip.subjectTag,
        channel: clip.channel,
        description: clip.description,
        interests: clip.tags && clip.tags.length ? clip.tags : [clip.subjectTag],
      })
      setHighlightIds(result.newNodeIds || [])
      setGraphRefresh((n) => n + 1)
      const n = result.addedNodes?.length || 0
      setToast({
        message: `Committed to memory · ${n} point${n === 1 ? '' : 's'} added`,
        action: { label: 'View Map', onClick: openGraph },
      })
      return result
    },
    [openGraph],
  )

  const onSaveError = useCallback((e) => {
    setToast({ tone: 'error', message: `Couldn’t save lesson. ${e.message}` })
  }, [])

  const immersive = tab === 'foryou' || tab === 'watch'

  return (
    <div className="flex min-h-full items-center justify-center bg-bg-200 sm:p-6">
      <div className="relative flex h-[100dvh] w-full max-w-[420px] flex-col overflow-hidden bg-bg-100 sm:h-[860px] sm:rounded-lg sm:border sm:border-gray-a-200 sm:shadow-modal">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {tab === 'learn' && (
            <CreateClips
              libraryCount={libraryCount}
              onBrowse={() => showFeed(null)}
              onDone={async (jobId) => {
                await loadCount()
                await showFeed(jobId)
              }}
            />
          )}

          {tab === 'foryou' && (
            <Feed
              clips={clips}
              scoped={scoped}
              focusIndex={playerIndex}
              onOpen={openPlayer}
              onEdit={() => setTab('learn')}
              onShowAll={() => showFeed(null)}
              onOpenGraph={openGraph}
              onSaveLesson={handleSaveLesson}
              onSaveError={onSaveError}
            />
          )}

          {tab === 'watch' &&
            (clips[playerIndex] ? (
              <ClipPlayer
                clip={clips[playerIndex]}
                index={playerIndex}
                total={clips.length}
                onClose={() => setTab('foryou')}
                onNavigate={navigate}
                onOpenGraph={openGraph}
                onSaveLesson={handleSaveLesson}
                onSaveError={onSaveError}
              />
            ) : (
              <WatchEmpty onGoFeed={() => selectTab('foryou')} />
            ))}

          {tab === 'progress' && <Progress onBrowse={() => showFeed(null)} />}

          {tab === 'map' && (
            <MemoryGraph
              onClose={() => setTab(returnTab.current)}
              refreshKey={graphRefresh}
              highlightIds={highlightIds}
            />
          )}
        </div>

        <TabBar tab={tab} onSelect={selectTab} dark={immersive} />

        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </div>
  )
}
