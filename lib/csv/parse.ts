/**
 * Minimal CSV parser — Sprint W3 Day 16 (PR #31).
 *
 * Why hand-rolled (vs. csv-parse / papaparse):
 *   - Zero deps — Vercel cold-start savings
 *   - We only need email + name columns; format is constrained
 *   - Russian Excel exports use ; (semicolon) as separator (locale quirk),
 *     so we auto-detect , vs ; vs \t per file
 *   - Pure JS (no Node-only APIs) so the SAME parser runs in the browser
 *     for live preview and on the server for authoritative validation
 *
 * Supports:
 *   - BOM (UTF-8 byte-order mark stripped)
 *   - Quoted fields with embedded commas / newlines: "Petrov, Ivan"
 *   - Escaped quotes inside quoted fields: "She said ""hi"""
 *   - Auto-detected separator: , or ; or \t (whichever appears first in
 *     the first non-empty line)
 *   - Header row detection: if first cell matches /^email$/i, skipped
 *   - Whitespace trimming on email + name
 *   - Email lowercasing (so dedup is case-insensitive)
 *
 * Returns one CsvRow per non-empty data row, with raw_line for error
 * reporting back to the user ("row 7: invalid email").
 */

export interface CsvRow {
  email: string
  name?: string
  /** 1-indexed line number in the original input (for user-facing errors) */
  raw_line: number
}

export interface CsvParseResult {
  rows: CsvRow[]
  separator: ',' | ';' | '\t'
  total_lines: number
  /** Empty / header / malformed lines that didn't produce a row */
  skipped_lines: number
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_RX.test(email.trim())
}

export function parseCsv(input: string): CsvParseResult {
  // Strip UTF-8 BOM if present
  const cleaned = input.replace(/^﻿/, '')

  // Detect separator from first non-empty line
  const firstLine = cleaned.split(/\r?\n/).find(l => l.trim()) ?? ''
  const sep: ',' | ';' | '\t' =
    firstLine.includes(';') ? ';' :
    firstLine.includes('\t') ? '\t' : ','

  const records = splitRecords(cleaned, sep)
  const rows: CsvRow[] = []
  let skipped = 0
  let dataRowSeen = false

  for (let i = 0; i < records.length; i++) {
    const { fields, raw_line } = records[i]

    // Empty / whitespace-only line
    if (fields.length === 0 || fields.every(f => !f.trim())) {
      skipped++
      continue
    }

    const first = fields[0].trim()

    // Header row — skip if first cell is literally "email"
    if (!dataRowSeen && /^email$/i.test(first)) {
      skipped++
      continue
    }

    dataRowSeen = true

    const email = first.toLowerCase()
    const name = (fields[1] ?? '').trim() || undefined
    rows.push({ email, name, raw_line })
  }

  return {
    rows,
    separator: sep,
    total_lines: records.length,
    skipped_lines: skipped,
  }
}

interface ParsedRecord {
  fields: string[]
  raw_line: number
}

/**
 * State-machine record splitter. Handles quoted fields per RFC 4180.
 * Tracks line numbers so each record carries its starting line.
 */
function splitRecords(input: string, sep: string): ParsedRecord[] {
  const out: ParsedRecord[] = []
  let cur: string[] = []
  let buf = ''
  let inQuotes = false
  let line = 1
  let recordStartLine = 1

  for (let i = 0; i < input.length; i++) {
    const c = input[i]

    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          // Escaped quote
          buf += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        buf += c
        if (c === '\n') line++
      }
      continue
    }

    if (c === '"') {
      inQuotes = true
    } else if (c === sep) {
      cur.push(buf)
      buf = ''
    } else if (c === '\n' || c === '\r') {
      // CRLF — consume the \n part too
      if (c === '\r' && input[i + 1] === '\n') i++

      cur.push(buf)
      out.push({ fields: cur, raw_line: recordStartLine })
      cur = []
      buf = ''
      line++
      recordStartLine = line
    } else {
      buf += c
    }
  }

  // Flush trailing record (no final newline)
  if (buf.length > 0 || cur.length > 0) {
    cur.push(buf)
    out.push({ fields: cur, raw_line: recordStartLine })
  }

  return out
}
