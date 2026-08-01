/** Appends a counter until the path is free. */
export function uniquePath(
  folder: string,
  fileName: string,
  exists: (path: string) => boolean
): string {
  const at = (name: string) =>
    folder === "" || folder === "/" ? `${name}.md` : `${folder}/${name}.md`;

  if (!exists(at(fileName))) return at(fileName);
  for (let n = 2; n < 1000; n++) {
    if (!exists(at(`${fileName} ${n}`))) return at(`${fileName} ${n}`);
  }
  return at(`${fileName} ${Date.now()}`);
}
