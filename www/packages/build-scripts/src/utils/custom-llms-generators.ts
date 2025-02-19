import { findPageTitle, oasFileToPath } from "docs-utils"
import { readFile } from "fs/promises"
import path from "path"
import pkg from "slugify"
import YAML from "yaml"

const slugify = pkg.default

const monorepoRoot = path.resolve(process.cwd(), "..", "..", "..")
const referencesRoot = path.join(monorepoRoot, "www", "apps", "resources")
const slugsPath = path.join(
  monorepoRoot,
  "www",
  "apps",
  "resources",
  "generated",
  "slug-changes.mjs"
)
const slugsFileContentPrefix = `export const slugChanges = `

export type CustomLlmsGenerator<T = Record<string, unknown>> = (
  files: string[],
  options?: T
) => Promise<string>

type CommonOptions = {
  baseUrl?: string
}

export const workflowsLlmsGenerator: CustomLlmsGenerator<
  CommonOptions
> = async (files, options) => {
  return generateListForReferenceFiles({
    files,
    title: "Workflows",
    itemContent: (title, fileSlug) =>
      `[${title.replace(/ - .+/, "")}](${fileSlug})`,
    options,
  })
}

export const stepsLlmsGenerator: CustomLlmsGenerator<CommonOptions> = async (
  files,
  options
) => {
  return generateListForReferenceFiles({
    files,
    title: "Steps",
    itemContent: (title, fileSlug) =>
      `[${title.replace(/ - .+/, "")}](${fileSlug})`,
    options,
  })
}

export const jsSdkLlmsGenerator: CustomLlmsGenerator<
  CommonOptions & {
    type: "Admin" | "Store" | "Auth"
  }
> = async (files, options) => {
  return generateListForReferenceFiles({
    files,
    title: `JS SDK ${options?.type}`,
    itemContent: (title, fileSlug) =>
      `[${title.replace(/ - .+/, "")}](${fileSlug})`,
    options,
  })
}

export const apiRefLlmsGenerator: CustomLlmsGenerator<
  CommonOptions & {
    type: "Admin" | "Store"
  }
> = async (files, options) => {
  let content = `## ${options?.type} API Reference\n\n`

  for (const file of files) {
    const baseName = path.basename(file)
    const fileYaml = YAML.parse(await readFile(file, "utf-8"))

    const oasPath = oasFileToPath(baseName)

    Object.entries(fileYaml).forEach(
      ([httpMethod, operation]: [string, any]) => {
        const hash =
          `${slugify(operation.tags[0])}_${slugify(operation.operationId)}`.toLowerCase()

        content += `- [${httpMethod.toUpperCase()} ${oasPath}](${options?.baseUrl}#${hash})\n`
      }
    )
  }

  return content
}

/**
 * Helpers
 */
export const generateListForReferenceFiles = async ({
  files,
  title,
  itemContent,
  options,
}: {
  files: string[]
  title: string
  itemContent: (title: string, fileSlug: string) => string
  options?: CommonOptions
}) => {
  const slugChanges = JSON.parse(
    (await readFile(slugsPath, "utf-8")).replace(slugsFileContentPrefix, "")
  )
  let content = `## ${title}\n\n`
  for (const file of files) {
    const relativeFilePath = file.replace(monorepoRoot, "")
    const fileSlug = `${options?.baseUrl}${
      slugChanges.find(
        (slugChange: any) => slugChange.filePath === relativeFilePath
      )?.newSlug ||
      file.replace(referencesRoot, "").replace(/\/page\.mdx?$/, "")
    }/index.html.md`

    const itemTitle = (findPageTitle(file) || "").replace(/ - .+/, "")

    content += `- ${itemContent(itemTitle, fileSlug)}\n`
  }

  return content
}
