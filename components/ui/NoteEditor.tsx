'use client'

import { useCallback, useMemo, useRef } from 'react'

// Detects if a line is a math expression
function isMathExpression(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  return /^\s*[\d.(][\d\s+\-*/.()\[\]]*$/.test(trimmed)
}

// Safely evaluate a math expression
function safeEval(expr: string): number | null {
  const cleaned = expr.replace(/\s+/g, '')
  if (!/^[\d+\-*/().]+$/.test(cleaned)) return null
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`'use strict'; return (${cleaned})`)() as unknown
    if (typeof result === 'number' && isFinite(result)) return result
    return null
  } catch {
    return null
  }
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return parseFloat(n.toFixed(4)).toString()
}

interface ComputedLine {
  index: number
  result: number
}

function computeLines(content: string): ComputedLine[] {
  const lines = content.split('\n')
  const computed: ComputedLine[] = []
  lines.forEach((line, i) => {
    if (isMathExpression(line)) {
      const result = safeEval(line.trim())
      if (result !== null) computed.push({ index: i, result })
    }
  })
  return computed
}

interface NoteEditorProps {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  placeholder?: string
  className?: string
  minRows?: number
}

export default function NoteEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = 'Write a note... (math expressions are evaluated inline)',
  className = '',
  minRows = 6,
}: NoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const computedLines = useMemo(() => computeLines(value), [value])

  const mathSum = useMemo(() => {
    if (computedLines.length < 2) return null
    return computedLines.reduce((acc, l) => acc + l.result, 0)
  }, [computedLines])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e.target.value)
    },
    [onChange]
  )

  const lines = value.split('\n')

  return (
    <div className={`note-editor relative font-mono text-sm ${className}`}>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          readOnly={readOnly}
          placeholder={placeholder}
          rows={Math.max(minRows, lines.length + 1)}
          className={[
            'w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3',
            'text-gray-800 leading-6 outline-none transition-colors',
            'placeholder:text-gray-400 font-mono text-sm',
            readOnly
              ? 'cursor-default bg-gray-50'
              : 'focus:border-blue-400 focus:ring-2 focus:ring-blue-100',
          ].join(' ')}
          style={{ lineHeight: '1.5rem' }}
        />

        {/* Inline result overlays */}
        {computedLines.length > 0 && (
          <div
            className="pointer-events-none absolute inset-0 px-4 py-3 overflow-hidden"
            aria-hidden="true"
          >
            {computedLines.map(({ index, result }) => {
              const linesBefore = lines.slice(0, index)
              const top = linesBefore.length * 1.5 // rem (1.5rem per line)
              const lineText = lines[index] ?? ''
              return (
                <div
                  key={index}
                  className="absolute flex items-center"
                  style={{ top: `calc(0.75rem + ${top}rem)` }}
                >
                  <span
                    className="invisible whitespace-pre font-mono text-sm"
                    style={{ lineHeight: '1.5rem' }}
                  >
                    {lineText}
                  </span>
                  <span className="ml-2 text-blue-500 font-medium select-none whitespace-nowrap">
                    = {formatNum(result)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sum footer */}
      {mathSum !== null && (
        <div className="mt-1 flex justify-end pr-1">
          <span className="text-xs text-gray-400 mr-1">Σ</span>
          <span className="text-xs font-semibold text-blue-600">{formatNum(mathSum)}</span>
        </div>
      )}

      {/* Computed results list (read-only display) */}
      {readOnly && computedLines.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {computedLines.map(({ index, result }) => (
            <div key={index} className="flex justify-between text-xs text-gray-500 px-1">
              <span className="truncate max-w-[60%] text-gray-400">{lines[index]?.trim()}</span>
              <span className="font-medium text-blue-500">= {formatNum(result)}</span>
            </div>
          ))}
          {mathSum !== null && (
            <div className="flex justify-between text-xs font-semibold text-blue-600 px-1 pt-1 border-t border-gray-100">
              <span>Total</span>
              <span>{formatNum(mathSum)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
