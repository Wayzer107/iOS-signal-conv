export type SignalDesktopRow = {
  conversationServiceId: string;
  conversationTitle: string;
  senderServiceId: string;
  sentAt: number;
  body: string | null;
  attachmentCount: number;
  quoteBody: string | null;
};
