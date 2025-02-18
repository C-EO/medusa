import { Transformer } from "unified"
import { ComponentLinkFixerOptions } from "types"
import { componentLinkFixer } from "./utils/component-link-fixer.js"

export function prerequisitesLinkFixerPlugin(
  options?: ComponentLinkFixerOptions
): Transformer {
  return componentLinkFixer("Prerequisites", "items", options)
}
