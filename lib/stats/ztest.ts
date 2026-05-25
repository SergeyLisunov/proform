/**
 * lib/stats/ztest.ts — extracted W15 Day 77.
 *
 * Two-proportion pooled Z-test, originally written для drip-email A/B
 * (W13 Day 66, see app/admin/ab-tests/page.tsx). Extracted в shared lib
 * для reuse в W15 Day 77 landing A/B calculator (`/admin/landing-ab`).
 *
 * Math reference:
 *   - H0: p_a = p_b (variants equivalent)
 *   - H1: p_a ≠ p_b (one wins — two-tailed)
 *   - Normal approximation OK при n ≥ 30 per group
 *   - p-value via Abramowitz & Stegun formula (no external stats lib)
 *
 * Gate: we require >= 30 per group hard floor для test mathematical validity.
 * Industry heuristic для marketing tests where noise floor высокий — at least
 * 100 per group. Caller может add additional volume gate.
 */

export interface ZTestResult {
  /** Z-statistic (B vs A direction — positive = B is higher conversion) */
  z:             number
  /** Two-tailed p-value (probability that observed difference is by chance) */
  pValue:        number
  /** True если pValue < 0.05 (95% confidence) AND samples >= 30 each */
  isSignificant: boolean
}

/**
 * Computes pooled-Z test для two binary-outcome groups.
 *
 * @param aConverted  successes в group A
 * @param aSize       total trials в group A
 * @param bConverted  successes в group B
 * @param bSize       total trials в group B
 *
 * @example
 *   const r = pooledZTest(50, 1000, 65, 1000)
 *   // r.z ≈ 1.41, r.pValue ≈ 0.16, isSignificant = false (within noise)
 */
export function pooledZTest(
  aConverted: number,
  aSize:      number,
  bConverted: number,
  bSize:      number,
): ZTestResult {
  if (aSize < 30 || bSize < 30) {
    return { z: 0, pValue: 1, isSignificant: false }
  }
  const pA = aConverted / aSize
  const pB = bConverted / bSize
  const pPool = (aConverted + bConverted) / (aSize + bSize)
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / aSize + 1 / bSize))
  if (se === 0) return { z: 0, pValue: 1, isSignificant: false }
  const z = (pB - pA) / se

  // Two-tailed p-value via normal approximation (Abramowitz & Stegun).
  const absZ = Math.abs(z)
  const t = 1 / (1 + 0.2316419 * absZ)
  const d = 0.3989423 * Math.exp(-absZ * absZ / 2)
  const probGreater =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  const pValue = 2 * probGreater

  return { z, pValue, isSignificant: pValue < 0.05 }
}
