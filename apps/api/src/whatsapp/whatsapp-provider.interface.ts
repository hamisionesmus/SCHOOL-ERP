export interface SendWhatsAppResult {
  success: boolean;
  providerMessageId?: string;
}

export interface WhatsAppProvider {
  send(to: string, body: string): Promise<SendWhatsAppResult>;
}

export const WHATSAPP_PROVIDER = 'WHATSAPP_PROVIDER';
