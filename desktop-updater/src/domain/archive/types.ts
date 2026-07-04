export type CanonicalMessage = {
  conversationKey: string;
  authorKey: string;
  timestampMs: number;
  body: string;
  hasAttachments: boolean;
  hasQuote: boolean;
  quoteBody: string | null;
};
