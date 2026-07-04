export function normalizeConversationKey(source: { serviceId: string; title: string }): string {
  // Prefer serviceId for stable key; fallback to title when missing
  if (source.serviceId && source.serviceId.length > 0) return source.serviceId;
  return source.title ?? '';
}
