export function generateUserAgent(): string {
  const id = Math.random().toString(36).slice(2, 10);
  return `sec-research-mcp/${id} (research; qa@localhost.invalid)`;
}

export function resolveUserAgent(userAgent: string | null | undefined): string {
  const trimmed = userAgent?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : generateUserAgent();
}
