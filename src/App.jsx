import { useCallback, useMemo, useRef, useState } from 'react'
import { SUBJECTS, getFeedClips } from './data/mockClips.js'
import { saveLesson } from './lib/memoryApi.js'
import SubjectInput from './screens/SubjectInput.jsx'
import Feed from './screens/Feed.jsx'
import ClipPlayer from './screens/ClipPlayer.jsx'
import MemoryGraph from './screens/MemoryGraph.jsx'
import Toast from './components/Toast.jsx'

export default function App() {
  const [view, setView] = useState('subjects') // 'subjects' | 'feed' | 'player' | 'graph'
  const [selected, setSelected] = useState(SUBJECTS.map((s) => s.name))
  const [playerIndex, setPlayerIndex] = useState(0)
  const [toast, setToast] = useState(null)
  const [graphRefresh, setGraphRefresh] = useState(0)
  const [highlightIds, setHighlightIds] = useState([])
  const returnView = useRef('feed')

  const feedClips = useMemo(() => getFeedClips(selected), [selected])

  const openPlayer = (i) => {
    setPlayerIndex(i)
    setView('player')
  }
  const navigate = (delta) => {
    setPlayerIndex((i) => Math.min(Math.max(i + delta, 0), feedClips.length - 1))
  }

  const openGraph = useCallback(() => {
    setView((v) => {
      if (v !== 'graph') returnView.current = v
      return 'graph'
    })
  }, [])

  // Save a watched clip as a lesson -> kicks off the memory pipeline (Claude
  // extracts memory points, Redis recalls related ones, connections persisted).
  const handleSaveLesson = useCallback(
    async (clip) => {
      const result = await saveLesson({
        title: clip.title,
        subject: clip.subjectTag,
        channel: clip.channel,
        description: clip.description,
        interests: selected,
      })
      setHighlightIds(result.newNodeIds || [])
      setGraphRefresh((n) => n + 1)
      const n = result.addedNodes?.length || 0
      setToast({
        message: `Lesson saved · ${n} memory point${n === 1 ? '' : 's'} added`,
        action: { label: 'View Graph', onClick: openGraph },
      })
      return result
    },
    [selected, openGraph],
  )

  const onSaveError = useCallback((e) => {
    setToast({ tone: 'error', message: `Couldn’t save lesson. ${e.message}` })
  }, [])

  return (
    // Phone frame on desktop; fills the viewport on mobile.
    <div className="flex min-h-full items-center justify-center bg-bg-200 sm:p-6">
      <div className="relative flex h-[100dvh] w-full max-w-[420px] flex-col overflow-hidden bg-bg-100 sm:h-[860px] sm:rounded-lg sm:border sm:border-gray-a-200 sm:shadow-modal">
        {view === 'subjects' && (
          <SubjectInput
            selected={selected}
            setSelected={setSelected}
            onFind={() => setView('feed')}
          />
        )}

        {view === 'feed' && (
          <Feed
            clips={feedClips}
            selected={selected}
            focusIndex={playerIndex}
            onOpen={openPlayer}
            onEdit={() => setView('subjects')}
            onOpenGraph={openGraph}
            onSaveLesson={handleSaveLesson}
            onSaveError={onSaveError}
          />
        )}

        {view === 'player' && feedClips[playerIndex] && (
          <ClipPlayer
            clip={feedClips[playerIndex]}
            index={playerIndex}
            total={feedClips.length}
            onClose={() => setView('feed')}
            onNavigate={navigate}
            onOpenGraph={openGraph}
            onSaveLesson={handleSaveLesson}
            onSaveError={onSaveError}
          />
        )}

        {view === 'graph' && (
          <MemoryGraph
            onClose={() => setView(returnView.current)}
            refreshKey={graphRefresh}
            highlightIds={highlightIds}
          />
        )}

        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </div>
  )
}
