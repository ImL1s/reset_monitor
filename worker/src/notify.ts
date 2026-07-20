/** Telegram notify — real Bot API when TELEGRAM_BOT_TOKEN + CHAT_ID set. */

export type NotifyKind = "confirmed" | "retract" | "pending_optional";

export type OutboxStatus =
  | "pending"
  | "sent"
  | "failed"
  | "skipped_no_config";

export interface OutboxItem {
  id: string;
  channel: "telegram";
  event_id: string;
  kind: NotifyKind;
  dedupe_key: string;
  status: OutboxStatus;
  payload: string;
  correction_of?: string | null;
  created_at: string;
  sent_at?: string | null;
  attempts?: number;
  last_error?: string | null;
}

const MAX_ATTEMPTS = 5;

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

  /** Restore items from KV (keeps sent for dedupe). */
  hydrate(items: OutboxItem[] | undefined | null): void {
    if (!items?.length) return;
    this.items = items.map((i) => ({
      ...i,
      attempts: i.attempts ?? 0,
    }));
  }

  serialize(): OutboxItem[] {
    // Cap memory: keep last 200, prefer non-sent first then recent sent
    const pending = this.items.filter(
      (i) => i.status === "pending" || i.status === "failed",
    );
    const rest = this.items
      .filter((i) => i.status === "sent" || i.status === "skipped_no_config")
      .slice(-100);
    return [...pending, ...rest].slice(-200);
  }

  enqueue(args: {
    event_id: string;
    kind: NotifyKind;
    payload: string;
    correction_of?: string;
  }): OutboxItem | null {
    const dedupe_key = `tg:${args.kind}:${args.event_id}`;
    if (
      args.kind === "confirmed" &&
      this.items.some(
        (i) =>
          i.dedupe_key === dedupe_key &&
          (i.status === "sent" || i.status === "skipped_no_config"),
      )
    ) {
      // skipped_no_config will flush when secrets appear — don't enqueue again
      return null;
    }
    const existing = this.items.find(
      (i) =>
        i.dedupe_key === dedupe_key &&
        (i.status === "pending" || i.status === "failed"),
    );
    if (existing) {
      if (existing.status === "failed") {
        existing.status = "pending";
        existing.last_error = null;
      }
      return existing;
    }

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
      attempts: 0,
      last_error: null,
    };
    this.items.push(item);
    return item;
  }

  async drain(): Promise<{
    sent: number;
    stub: number;
    retried: number;
    errors: string[];
  }> {
    let sent = 0;
    let stub = 0;
    let retried = 0;
    const errors: string[] = [];

    for (const item of this.items) {
      if (item.status !== "pending" && item.status !== "failed") continue;
      if ((item.attempts ?? 0) >= MAX_ATTEMPTS) {
        item.status = "failed";
        continue;
      }

      if (!this.telegramBotToken || !this.telegramChatId) {
        // Do NOT mark as sent — so configuring secrets later can still deliver
        if (item.status !== "skipped_no_config") {
          item.status = "skipped_no_config";
          console.log(
            `[notify-stub] ${item.dedupe_key}: ${item.payload.slice(0, 120)}`,
          );
          stub += 1;
        }
        continue;
      }

      // Promote skipped → pending when secrets appear
      if (item.status === "skipped_no_config") {
        item.status = "pending";
      }

      item.attempts = (item.attempts ?? 0) + 1;
      if (item.attempts > 1) retried += 1;

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
          item.last_error = `tg_http_${res.status}`;
          errors.push(`tg_http_${res.status}`);
          continue;
        }
        item.status = "sent";
        item.sent_at = new Date().toISOString();
        item.last_error = null;
        sent += 1;
      } catch (e) {
        item.status = "failed";
        item.last_error = e instanceof Error ? e.message : String(e);
        errors.push(item.last_error);
      }
    }

    // Re-queue skipped_no_config when token becomes available next drain
    for (const item of this.items) {
      if (
        item.status === "skipped_no_config" &&
        this.telegramBotToken &&
        this.telegramChatId
      ) {
        item.status = "pending";
      }
    }

    return { sent, stub, retried, errors };
  }

  list() {
    return [...this.items];
  }
}

export const notifyOutbox = new NotifyOutbox();
