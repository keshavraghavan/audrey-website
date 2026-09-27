// Reads a hand-configured env var. Trimmed because these get pasted into a
// hosting dashboard, where a trailing newline rides along and surfaces later as
// a rejection that looks nothing like a whitespace problem. Blank counts as
// unset.
export function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}
