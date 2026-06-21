import { useCallback, useEffect, useState } from 'react'
import { listClips } from './api.js'
import { decorateClip } from './lib/clips.js'
import CreateClips from './screens/CreateClips.jsx'
import Feed from './screens/Feed.jsx'
import ClipPlayer from './screens/ClipPlayer.jsx'

export default function App() {
  const [view, setView] = useState('create') // 'create' | 'feed' | 'player'
  const [clips, setClips] = useState([])
  const [libraryCount, setLibraryCount] = useState(0)
  const [scoped, setScoped] = useState(false) // feed showing one topic vs whole library
  const [playerIndex, setPlayerIndex] = useState(0)

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

  // Show the feed scoped to one job (a topic) or the whole library (jobId=null).
  const showFeed = async (jobId) => {
    try {
      const { clips: raw } = await listClips(jobId)
      setClips(raw.map(decorateClip))
    } catch {
      setClips([])
    }
    setScoped(!!jobId)
    setPlayerIndex(0)
    setView('feed')
  }

  const openPlayer = (i) => {
    setPlayerIndex(i)
    setView('player')
  }
  const navigate = (delta) => {
    setPlayerIndex((i) => Math.min(Math.max(i + delta, 0), clips.length - 1))
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-bg-200 sm:p-6">
      <div className="relative flex h-[100dvh] w-full max-w-[420px] flex-col overflow-hidden bg-bg-100 sm:h-[860px] sm:rounded-lg sm:border sm:border-gray-a-200 sm:shadow-modal">
        {view === 'create' && (
          <CreateClips
            libraryCount={libraryCount}
            onBrowse={async () => {
              await loadCount()
              await showFeed(null) // whole library
            }}
            onDone={async (jobId) => {
              await loadCount()
              await showFeed(jobId) // only the topic just generated
            }}
          />
        )}

        {view === 'feed' && (
          <Feed
            clips={clips}
            scoped={scoped}
            focusIndex={playerIndex}
            onOpen={openPlayer}
            onEdit={() => setView('create')}
            onShowAll={() => showFeed(null)}
          />
        )}

        {view === 'player' && clips[playerIndex] && (
          <ClipPlayer
            clip={clips[playerIndex]}
            index={playerIndex}
            total={clips.length}
            onClose={() => setView('feed')}
            onNavigate={navigate}
          />
        )}
      </div>
    </div>
  )
}
