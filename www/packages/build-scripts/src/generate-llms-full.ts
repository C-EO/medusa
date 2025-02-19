import { getCleanMd, GetCleanMdOptions } from "docs-utils"
import { fdir } from "fdir"
import { writeFile } from "fs/promises"
import path from "path"
import {
  apiRefLlmsGenerator,
  CustomLlmsGenerator,
  jsSdkLlmsGenerator,
  stepsLlmsGenerator,
  workflowsLlmsGenerator,
} from "./utils/custom-llms-generators.js"

type FileExt = "md" | "yaml"

type Options = {
  outputPath: string
  scanDirs: {
    dir: string
    options?: Omit<GetCleanMdOptions, "file" | "type">
    allowedFilesPatterns?: RegExp[]
    generator?: {
      name: "workflows" | "steps" | "jsSdk" | "apiRef"
      options: Record<string, unknown>
    }
    ext?: FileExt
  }[]
  introText?: string
  plugins?: GetCleanMdOptions["plugins"]
}

const generators: Record<string, CustomLlmsGenerator<any>> = {
  workflows: workflowsLlmsGenerator,
  steps: stepsLlmsGenerator,
  jsSdk: jsSdkLlmsGenerator,
  apiRef: apiRefLlmsGenerator,
}

const isExtAllowed = (fileName: string, allowedExt: FileExt) => {
  switch (allowedExt) {
    case "md":
      return fileName.endsWith(".md") || fileName.endsWith(".mdx")
    case "yaml":
      return fileName.endsWith(".yaml") || fileName.endsWith(".yml")
  }
}

const getContentFromDir = async ({
  dir,
  options = {},
  allowedFilesPatterns,
  generator,
  ext = "md",
}: Options["scanDirs"][0]): Promise<string> => {
  const files = await new fdir()
    .withFullPaths()
    .filter((file) => {
      const baseName = path.basename(file)

      return isExtAllowed(baseName, ext) && !baseName.startsWith("_")
    })
    .filter(
      (file) =>
        !allowedFilesPatterns?.length ||
        allowedFilesPatterns.some((pattern) => file.match(pattern))
    )
    .crawl(dir)
    .withPromise()

  const content: string[] =
    generator?.name && generators[generator?.name]
      ? [await generators[generator?.name](files, generator.options)]
      : []

  if (content.length) {
    return await getCleanMd({
      file: content.join("\n\n"),
      ...options,
      type: "content",
    })
  }

  for (const file of files) {
    content.push(
      await getCleanMd({
        file,
        ...options,
      })
    )
  }

  return content.join("\n\n")
}

export const generateLlmsFull = async ({
  outputPath,
  scanDirs,
  introText = "",
  plugins,
}: Options) => {
  const text: string[] = [introText]

  for (const scanDir of scanDirs) {
    text.push(
      await getContentFromDir({
        ...scanDir,
        options: {
          plugins,
          ...scanDir.options,
        },
      })
    )
  }

  await writeFile(outputPath, text.join("\n\n"))
}
