/**
 * Числовые хелперы движка аналитики.
 */

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Популяционное СКО (монотонность Фостера считается по всему окну). */
export function populationSd(values: number[]): number | null {
  const avg = mean(values);
  if (avg === null) {
    return null;
  }
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export type LinearFit = {
  slope: number;
  intercept: number;
};

/**
 * МНК-аппроксимация y = intercept + slope * x.
 * null при < 2 точках или нулевом разбросе x.
 */
export function fitLine(points: Array<{ x: number; y: number }>): LinearFit | null {
  if (points.length < 2) {
    return null;
  }
  const n = points.length;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  const ssX = points.reduce((sum, p) => sum + (p.x - meanX) ** 2, 0);
  if (ssX === 0) {
    return null;
  }
  const ssXY = points.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0);
  const slope = ssXY / ssX;
  return { slope, intercept: meanY - slope * meanX };
}
