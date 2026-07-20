/** Telegram notify — real Bot API when TELEGRAM_BOT_TOKEN + CHAT_ID set. */

export type NotifyKind = "confirmed" | "retract" | "pending_optional";

export interface OutboxItem {
  id: string;
  channel: "telegram";
  event_id: string;
  kind: NotifyKind;
  dedupe_key: string;
  status: "pending" | "sent" | "failed" | "skipped";
  payload: string;
  correction_of?: string | null;
  created_at: string;
  sent_at?: string | null;
}

export class NotifyOutbox {
  items: OutboxItem[] = [];
  telegramBotToken: string | null = null;
  telegramChatId: string | null = null;
  fetchImpl: typeof fetch = fetch;

  configure(opts: {
    botToken?: string | null;
    chatId?: string | null;
    fetchImpl?: typeof fetch;
  }) {
    if (opts.botToken !== undefined) this.telegramBotToken = opts.botToken;
    if (opts.chatId !== undefined) this.telegramChatId = opts.chatId;
    if (opts.fetchImpl) this.fetchImpl = opts.fetchImpl;
  }

  enqueue(args: {
    event_id: string;
    kind: NotifyKind;
    payload: string;
    correction_of?: string;
  }): OutboxItem | null {
    const dedupe_key = `tg:${args.kind}:${args.event_id}`;
    if (this.items.some((i) => i.dedupe_key === dedupe_key && i.status === "sent")) {
      if (args.kind === "confirmed") return null;
    }
    // allow retract after confirmed
    if (
      args.kind === "confirmed" &&
      this.items.some((i) => i.dedupe_key === dedupe_key && i.status === "sent")
    ) {
      return null;
    }
    const existing = this.items.find(
      (i) => i.dedupe_key === dedupe_key && i.status === "pending",
    );
    if (existing) return existing;

    const item: OutboxItem = {
      id: `out_${crypto.randomUUID().slice(0, 12)}`,
      channel: "telegram",
      event_id: args.event_id,
      kind: args.kind,
      dedupe_key,
      status: "pending",
      payload: args.payload,
      correction_of: args.correction_of ?? null,
      created_at: new Date().toISOString(),
    };
    this.items.push(item);
    return item;
  }

  async drain(): Promise<{ sent: number; stub: number; errors: string[] }> {
    let sent = 0;
    let stub = 0;
    const errors: string[] = [];
    for (const item of this.items) {
      if (item.status !== "pending") continue;
      if (!this.telegramBotToken || !this.telegramChatId) {
        console.log(
          `[notify-stub] ${item.dedupe_key}: ${item.payload.slice(0, 120)}`,
        );
        item.status = "sent";
        item.sent_at = new Date().toISOString();
        stub += 1;
        continue;
      }
      try {
        const url = `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`;
        const res = await this.fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: this.telegramChatId,
            text: item.payload.slice(0, 4000),
            disable_web_page_preview: false,
          }),
        });
        if (!res.ok) {
          item.status = "failed";
          errors.push(`tg_http_${res.status}`);
          continue;
        }
        item.status = "sent";
        item.sent_at = new Date().toISOString();
        sent += 1;
      } catch (e) {
        item.status = "failed";
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    return { sent, stub, errors };
  }

  list() {
    return [...this.items];
  }
}

export const notifyOutbox = new NotifyOutbox();
