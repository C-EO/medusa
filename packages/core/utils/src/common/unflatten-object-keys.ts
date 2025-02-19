import { isObject } from "./is-object"

/**
 * unFlatten object keys
 * @example
 * input: {
 *   "variants.sku": { $like: "%-1" },
 *   "variants.prices.amount": { $gt: 30 },
 *   "variants.prices.currency": "USD"
 * }
 *
 * output: {
 *   {
 *       "variants": {
 *         "sku": {
 *           "$like": "%-1"
 *         },
 *         "prices": {
 *           "amount": {
 *             "$gt": 30
 *           },
 *           "currency": "USD"
 *         }
 *       }
 *     }
 * }
 *
 * @param input
 */
export function unflattenObjectKeys(
  flattened: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = {}

  for (const key in flattened) {
    if (!key.includes(".")) {
      if (isObject(result[key])) {
        result[key] = { ...result[key], ...flattened[key] }
      } else {
        result[key] = flattened[key]
      }
    }
  }

  for (const key in flattened) {
    if (key.includes(".")) {
      const value = flattened[key]
      const keys = key.split(".")
      let current = result

      for (let i = 0; i < keys.length; i++) {
        const part = keys[i]

        if (i === keys.length - 1) {
          if (isObject(value) && current[part]) {
            current[part] = { ...current[part], ...value }
          } else {
            current[part] = value
          }
        } else {
          current = current[part] = current[part] ?? {}
        }
      }
    }
  }

  return result
}
