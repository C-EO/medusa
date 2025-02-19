import { UnistNode, UnistTree } from "types"
import { Transformer } from "unified"

export const changeLinksToHtmlMdPlugin = (): Transformer => {
  return async (tree) => {
    const { visit } = await import("unist-util-visit")

    visit(tree as UnistTree, ["link"], (node: UnistNode) => {
      if (
        node.type === "link" &&
        node.url?.startsWith("https://docs.medusajs.com") &&
        !node.url.endsWith("index.html.md") &&
        !node.url.includes("/api/store") &&
        !node.url.includes("/api/admin")
      ) {
        node.url += `/index.html.md`
      }
    })
  }
}
