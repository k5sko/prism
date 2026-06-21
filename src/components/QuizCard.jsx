import { useState } from 'react'

// Interstitial comprehension check that slides up over the reel feed every few
// reels. Sequential MCQs: tap an option to reveal correct/incorrect + a one-line
// explanation, then advance. Dismissable (Skip) so it never traps the viewer.
export default function QuizCard({ quiz, onClose }) {
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(0)

  const q = quiz[qi]
  const last = qi >= quiz.length - 1

  const choose = (i) => {
    if (revealed) return
    setPicked(i)
    setRevealed(true)
    if (i === q.answer_index) setCorrect((c) => c + 1)
  }

  const advance = () => {
    if (last) {
      onClose(correct, quiz.length)
      return
    }
    setQi((i) => i + 1)
    setPicked(null)
    setRevealed(false)
  }

  const optClass = (i) => {
    if (!revealed) return 'border-white/15 bg-white/5 hover:bg-white/10 text-white'
    if (i === q.answer_index) return 'border-green-700 bg-green-700/20 text-white'
    if (i === picked) return 'border-red-700 bg-red-700/20 text-white'
    return 'border-white/10 bg-white/[0.03] text-white/45'
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/70 backdrop-blur-md animate-fade-up">
      <div className="m-3 rounded-xl border border-white/10 bg-[#10131c]/95 p-5 shadow-modal">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-400">
            Quick check · {qi + 1}/{quiz.length}
          </span>
          <button
            onClick={() => onClose(correct, quiz.length)}
            className="text-[12px] font-medium text-white/45 transition-colors hover:text-white/80"
          >
            Skip
          </button>
        </div>

        <p className="font-head mb-4 text-[19px] font-semibold leading-7 tracking-[-0.3px] text-white">
          {q.question}
        </p>

        <div className="flex flex-col gap-2">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={revealed}
              className={`flex items-center gap-3 rounded-md border px-3.5 py-3 text-left text-[15px] leading-5 transition-colors duration-150 ease-geist ${optClass(i)}`}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current text-[11px] font-semibold opacity-70">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{opt}</span>
              {revealed && i === q.answer_index && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-green-400">
                  <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {revealed && i === picked && i !== q.answer_index && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-red-400">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {revealed && q.explanation && (
          <p className="mt-3.5 rounded-md bg-white/[0.04] px-3.5 py-2.5 text-[13px] leading-5 text-white/70">
            {q.explanation}
          </p>
        )}

        <button
          onClick={advance}
          disabled={!revealed}
          className="mt-4 flex h-12 w-full items-center justify-center rounded-md bg-accent-400 text-[15px] font-semibold text-white transition-colors duration-150 ease-geist hover:bg-accent-500 disabled:bg-accent-400/30 disabled:text-white/40"
        >
          {last ? 'Back to reels' : 'Next question'}
        </button>
      </div>
    </div>
  )
}
