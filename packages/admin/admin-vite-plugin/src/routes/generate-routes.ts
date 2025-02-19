import fs from "fs/promises"
import { outdent } from "outdent"
import { File, parse, ParseResult, traverse } from "../babel"
import { logger } from "../logger"
import {
  crawl,
  getParserOptions,
  hasDefaultExport,
  normalizePath,
} from "../utils"
import { getRoute } from "./helpers"

type Route = {
  Component: string
  path: string
  handle?: string
  loader?: string
  children?: Route[]
}

type RouteResult = {
  imports: string[]
  route: Route
}

export async function generateRoutes(sources: Set<string>) {
  const files = await getFilesFromSources(sources)
  const results = await getRouteResults(files)
  const imports = results.map((result) => result.imports).flat()
  const code = generateCode(results)

  return {
    imports,
    code,
  }
}

function generateCode(results: RouteResult[]): string {
  return outdent`
        routes: [
            ${results.map((result) => formatRoute(result.route)).join(",\n")}
        ]
    }
  `
}

function formatRoute(route: Route): string {
  let base = `{
    Component: ${route.Component},
    path: "${route.path}"`

  if (route.handle) {
    base += `,
    handle: ${route.handle}`
  }

  if (route.loader) {
    base += `,
    loader: ${route.loader}`
  }

  if (route.children?.length) {
    return `${base},
    children: [
      ${route.children.map((child) => formatRoute(child)).join(",\n      ")}
    ]
  }`
  }

  return `${base}
  }`
}

async function getFilesFromSources(sources: Set<string>): Promise<string[]> {
  const files = (
    await Promise.all(
      Array.from(sources).map(async (source) =>
        crawl(`${source}/routes`, "page", { min: 1 })
      )
    )
  ).flat()
  return files
}

async function getRouteResults(files: string[]): Promise<RouteResult[]> {
  const results = (await Promise.all(files.map(parseFile))).filter(
    (result): result is RouteResult => result !== null
  )

  const routeMap = new Map<string, RouteResult>()

  results.forEach((result) => {
    const routePath = result.route.path
    const isParallel = routePath.includes("/@")

    if (isParallel) {
      const parentPath = routePath.split("/@")[0]
      const parent = routeMap.get(parentPath)
      if (parent) {
        parent.route.children = parent.route.children || []

        /**
         * We do not want to include the @ in the final path, so we remove it.
         */
        const finalRoute = {
          ...result.route,
          path: result.route.path.replace("@", ""),
        }

        parent.route.children.push(finalRoute)
        parent.imports.push(...result.imports)
      }
    } else {
      routeMap.set(routePath, result)
    }
  })

  return Array.from(routeMap.values())
}

async function parseFile(
  file: string,
  index: number
): Promise<RouteResult | null> {
  const code = await fs.readFile(file, "utf-8")

  let ast: ParseResult<File> | null = null

  try {
    ast = parse(code, getParserOptions(file))
  } catch (e) {
    logger.error("An error occurred while parsing the file.", {
      file,
      error: e,
    })
    return null
  }

  if (!(await isValidRouteFile(ast, file))) {
    return null
  }

  const { hasHandle, hasLoader } = await hasNamedExports(ast, file)
  const routePath = getRoute(file)

  const imports = generateImports(file, index, hasHandle, hasLoader)
  const route = generateRoute(routePath, index, hasHandle, hasLoader)

  return {
    imports,
    route,
  }
}

async function isValidRouteFile(
  ast: ParseResult<File>,
  file: string
): Promise<boolean> {
  try {
    return await hasDefaultExport(ast)
  } catch (e) {
    logger.error(
      `An error occurred while checking for a default export in ${file}. The file will be ignored. See the below error for more details:\n${e}`
    )
    return false
  }
}

function generateImports(
  file: string,
  index: number,
  hasHandle: boolean,
  hasLoader: boolean
): string[] {
  const imports: string[] = []
  const route = generateRouteComponentName(index)
  const importPath = normalizePath(file)

  if (!hasHandle && !hasLoader) {
    imports.push(`import ${route} from "${importPath}"`)
  } else {
    const namedImports = [
      hasHandle && `handle as ${generateHandleName(index)}`,
      hasLoader && `loader as ${generateLoaderName(index)}`,
    ]
      .filter(Boolean)
      .join(", ")
    imports.push(`import ${route}, { ${namedImports} } from "${importPath}"`)
  }

  return imports
}

function generateRoute(
  route: string,
  index: number,
  hasHandle: boolean,
  hasLoader: boolean
): Route {
  return {
    Component: generateRouteComponentName(index),
    path: route,
    handle: hasHandle ? generateHandleName(index) : undefined,
    loader: hasLoader ? generateLoaderName(index) : undefined,
  }
}

function generateRouteComponentName(index: number): string {
  return `RouteComponent${index}`
}

function generateHandleName(index: number): string {
  return `handle${index}`
}

function generateLoaderName(index: number): string {
  return `loader${index}`
}

async function hasNamedExports(
  ast: ParseResult<File>,
  file: string
): Promise<{ hasHandle: boolean; hasLoader: boolean }> {
  let hasHandle = false
  let hasLoader = false

  try {
    traverse(ast, {
      ExportNamedDeclaration(path) {
        const declaration = path.node.declaration

        // Handle: export const handle = {...}
        if (declaration?.type === "VariableDeclaration") {
          declaration.declarations.forEach((decl) => {
            if (decl.id.type === "Identifier" && decl.id.name === "handle") {
              hasHandle = true
            }
            if (decl.id.type === "Identifier" && decl.id.name === "loader") {
              hasLoader = true
            }
          })
        }

        // Handle: export function loader() or export async function loader()
        if (
          declaration?.type === "FunctionDeclaration" &&
          declaration.id?.name === "loader"
        ) {
          hasLoader = true
        }
      },
    })
  } catch (e) {
    logger.error("An error occurred while checking for named exports.", {
      file,
      error: e,
    })
  }

  return { hasHandle, hasLoader }
}
