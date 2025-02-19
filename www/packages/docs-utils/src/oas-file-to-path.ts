export function oasFileToPath(fileName: string): string {
  return `/${fileName
    .replaceAll(/(?<!\{[^}]*)_(?![^{]*\})/g, "/")
    .replace(/\.[A-Za-z]+$/, "")}`
}
