/**
 * lib/utils/search.ts — W21 audit fix (M1).
 *
 * Sanitize user-supplied search terms before interpolating them into a
 * PostgREST `.or(...)` / `.ilike(...)` filter string. PostgREST's filter DSL
 * treats `,` `.` `(` `)` `"` as syntax — an unsanitized term like
 * `%,id.eq.<uuid>` could break out of the intended ilike clause and inject
 * extra filter conditions. We strip those metacharacters (plus `%` `*`
 * wildcards and backslash) so the term can only ever be matched literally.
 *
 * RLS still enforces row access; this prevents filter-clause manipulation.
 */
export function sanitizeFilterTerm(input: string): string {
  return input.replace(/[,.()"'%*\\]/g, '').trim()
}
