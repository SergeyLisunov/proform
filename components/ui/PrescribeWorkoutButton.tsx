'use client'

import { useState } from 'react'
import { PrescribeWorkoutDrawer } from '@/components/ui/PrescribeWorkoutDrawer'

type Athlete = { id: string; name: string }

/** Small button used on the coach dashboard that opens the prescribe drawer. */
export default function PrescribeWorkoutButton({
  coachId, athletes,
}: {
  coachId: string
  athletes: Athlete[]
}) {
  const [open, setOpen] = useState(false)

  if (athletes.length === 0) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-orange-500 text-white px-4 py-2 text-xs font-semibold hover:bg-orange-600"
      >
        <i className="ki-filled ki-plus text-xs"/>
        Назначить тренировку атлету
      </button>
      {open && (
        <PrescribeWorkoutDrawer
          coachId={coachId}
          athletes={athletes}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
