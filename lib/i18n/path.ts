export type MessageVars = Record<string, string | number>;

export function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (full, key: string) =>
    vars[key] == null ? full : String(vars[key]),
  );
}

export function lookup(tree: unknown, path: string): string | undefined {
  let current: unknown = tree;
  for (const part of path.split(".")) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}
