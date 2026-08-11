/**
 * Zod-схема → компактный «скетч» формы ответа для промпта.
 *
 * ЗАЧЕМ. У Ollama/Gemma нет аналога generateObject: модель не узнает,
 * какой формы ответ мы ждём, пока мы не опишем её словами прямо в
 * промпте. Без этого структурированные вызовы вырождаются в угадайку.
 *
 * ПОЧЕМУ НЕ ПОЛНЫЙ JSON Schema. Ради него пришлось бы тянуть
 * zod-to-json-schema, а его вывод многословен ($ref, additionalProperties,
 * вложенные definitions) — он съедает контекст и читается моделью хуже,
 * чем короткий скетч, где рядом с полем сразу стоят ограничения и текст
 * из .describe(). Мы платим за это хождением по внутреннему `_def`
 * (публичного интроспекционного API у Zod v3 нет) — компромисс осознанный.
 *
 * ГРАНИЦА ОТВЕТСТВЕННОСТИ. Скетч — это ПОДСКАЗКА, а не контракт.
 * Единственный источник истины при проверке ответа — сама схема
 * (`schema.safeParse` в lib/ai/gemma). Поэтому незнакомый узел здесь
 * деградирует в "any" и НЕ роняет вызов: хуже подсказка — не страшно,
 * упавший AI-роут из-за экзотического типа — страшно.
 */
import type { z } from 'zod'

/** Защита от самоссылающихся схем: глубже — просто "any". */
const MAX_DEPTH = 8
const INDENT = '  '

/**
 * Форма внутренностей Zod v3, которой мы реально пользуемся. Держим её
 * одним узким типом, чтобы приведения были в одном месте, а не россыпью
 * `any` по коду.
 */
interface ZodDefLike {
  typeName?: string
  description?: string
  checks?: Array<{ kind: string; value?: unknown; regex?: RegExp }>
  values?: readonly string[]
  value?: unknown
  type?: unknown              // ZodArray → тип элемента
  innerType?: unknown         // ZodOptional / ZodNullable / ZodDefault
  schema?: unknown            // ZodEffects (refine / transform)
  options?: readonly unknown[] // ZodUnion
  valueType?: unknown         // ZodRecord
  items?: readonly unknown[]  // ZodTuple
  minLength?: { value: number } | null
  maxLength?: { value: number } | null
  /** ZodArray.length(n) — отдельное поле, НЕ min+max. */
  exactLength?: { value: number } | null
}

interface ZodLike {
  _def?: ZodDefLike
  shape?: Record<string, unknown>
  description?: string
}

function defOf(schema: unknown): ZodDefLike {
  return (schema as ZodLike | undefined)?._def ?? {}
}

function descriptionOf(schema: unknown): string | undefined {
  const s = schema as ZodLike | undefined
  const raw = s?.description ?? s?._def?.description
  if (typeof raw !== 'string') return undefined
  // Переводы строк внутри .describe() сломали бы построчный скетч.
  const flat = raw.replace(/\s+/g, ' ').trim()
  return flat || undefined
}

/** Ограничения строки/числа в виде "(>=0, <=10, целое)". */
function constraintsOf(def: ZodDefLike): string {
  const parts: string[] = []
  for (const check of def.checks ?? []) {
    switch (check.kind) {
      case 'min': parts.push(`>=${String(check.value)}`); break
      case 'max': parts.push(`<=${String(check.value)}`); break
      case 'int': parts.push('целое'); break
      case 'length': parts.push(`ровно ${String(check.value)} символов`); break
      case 'regex': parts.push(`шаблон ${String(check.regex)}`); break
      case 'email': parts.push('email'); break
      case 'url': parts.push('url'); break
      case 'uuid': parts.push('uuid'); break
      case 'datetime': parts.push('ISO datetime'); break
      default: break
    }
  }
  return parts.length ? ` (${parts.join(', ')})` : ''
}

function arrayCardinality(def: ZodDefLike): string {
  // .length(n) критичен для промпта (например «ровно 7 дней недели») и
  // лежит в отдельном поле — через min/max его не увидеть.
  const exact = def.exactLength?.value
  if (typeof exact === 'number') return ` (ровно ${exact} элементов)`

  const min = def.minLength?.value
  const max = def.maxLength?.value
  if (typeof min === 'number' && typeof max === 'number') {
    return min === max ? ` (ровно ${min} элементов)` : ` (от ${min} до ${max} элементов)`
  }
  if (typeof max === 'number') return ` (не более ${max} элементов)`
  if (typeof min === 'number') return ` (не менее ${min} элементов)`
  return ''
}

/** Рекурсивный рендер одного узла. `pad` — отступ ТЕКУЩЕГО уровня. */
function render(schema: unknown, pad: string, depth: number): string {
  if (depth > MAX_DEPTH) return 'any'
  const def = defOf(schema)

  switch (def.typeName) {
    case 'ZodString':  return `string${constraintsOf(def)}`
    case 'ZodNumber':  return `number${constraintsOf(def)}`
    case 'ZodBigInt':  return 'number (целое)'
    case 'ZodBoolean': return 'boolean'
    case 'ZodDate':    return 'string (дата ISO)'
    case 'ZodNull':    return 'null'
    case 'ZodLiteral': return JSON.stringify(def.value)

    case 'ZodEnum':
    case 'ZodNativeEnum':
      return (def.values ?? []).map(v => JSON.stringify(v)).join(' | ') || 'string'

    case 'ZodOptional':
      return `${render(def.innerType, pad, depth)} (можно опустить)`
    case 'ZodNullable':
      return `${render(def.innerType, pad, depth)} или null`
    case 'ZodDefault':
      return `${render(def.innerType, pad, depth)} (можно опустить)`
    case 'ZodEffects':
      return render(def.schema, pad, depth)

    case 'ZodUnion':
      return (def.options ?? []).map(o => render(o, pad, depth + 1)).join(' | ')

    case 'ZodArray': {
      const inner = render(def.type, pad, depth + 1)
      // "T[]" читается однозначно только для односложного T. Всё, где есть
      // пробел (ограничения, union) или перенос строки (объект), заворачиваем
      // в Array<...>: иначе `"a" | "b"[]` выглядит как массив из одного "b".
      return /[\s\n]/.test(inner)
        ? `Array<${inner}>${arrayCardinality(def)}`
        : `${inner}[]${arrayCardinality(def)}`
    }

    case 'ZodTuple':
      return `[${(def.items ?? []).map(i => render(i, pad, depth + 1)).join(', ')}]`

    case 'ZodRecord':
      return `{ "<ключ>": ${render(def.valueType, pad, depth + 1)} }`

    case 'ZodObject': {
      const shape = (schema as ZodLike).shape ?? {}
      const keys = Object.keys(shape)
      if (keys.length === 0) return '{}'
      const inner = pad + INDENT
      const lines = keys.map((key, i) => {
        const field = shape[key]
        const body = render(field, inner, depth + 1)
        const note = descriptionOf(field)
        // Запятая ДО комментария: иначе разделитель полей уезжает внутрь
        // "// ..." и в глазах модели последнее поле выглядит как последнее.
        const comma = i < keys.length - 1 ? ',' : ''
        return `${inner}${JSON.stringify(key)}: ${body}${comma}${note ? `  // ${note}` : ''}`
      })
      return `{\n${lines.join('\n')}\n${pad}}`
    }

    default:
      // ZodAny / ZodUnknown / что-то, чего мы ещё не встречали.
      return 'any'
  }
}

/**
 * Человекочитаемый скетч схемы для вставки в промпт.
 * Пример: `{ "score": number (>=0, <=10), "tags": string[] (не более 5 элементов) }`
 */
export function describeZodSchema(schema: z.ZodTypeAny | z.ZodType<unknown>): string {
  const body = render(schema, '', 0)
  const note = descriptionOf(schema)
  return note ? `${body}  // ${note}` : body
}
