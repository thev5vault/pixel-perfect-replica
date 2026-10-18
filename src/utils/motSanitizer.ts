const STATUTORY_CLAUSE_CODE = /\(\d+(\.\d+)*(\s*\([a-z0-9]+\))*\)/gi;

export function formatMotAdvisories(text: string): string[] {
  return text
    .replace(STATUTORY_CLAUSE_CODE, "")
    .split(/[;\r\n]+/)
    .map((item) => item.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean)
    .map((item) => item.charAt(0).toLocaleUpperCase("en-GB") + item.slice(1));
}
