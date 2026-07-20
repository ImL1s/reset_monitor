/** Telegram notify stub — real Bot API is W3+ with TELEGRAM_BOT_TOKEN. */

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

  enqueue(args: {
    event_id: string;
    kind: NotifyKind;
    payload: string;
    correction_of?: string;
  }): OutboxItem | null {
    const dedupe_key = `tg:${args.kind}:${args.event_id}`;
    if (this.items.some((i) => i.dedupe_key === dedupe_key && i.status === "sent")) {
      return null; // dedupe
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

  /** Stub drain: mark pending as sent (logs to console). */
  drain(): OutboxItem[] {
    const sent: OutboxItem[] = [];
    for (const item of this.items) {
      if (item.status !== "pending") continue;
      // Real: fetch https://api.telegram.org/bot$TOKEN/sendMessage
      console.log(`[notify-stub] ${item.dedupe_key}: ${item.payload.slice(0, 120)}`);
      item.status = "sent";
      item.sent_at = new Date().toISOString();
      sent.push(item);
    }
    return sent;
  }

  list() {
    return [...this.items];
  }
}

export const notifyOutbox = new NotifyOutbox();
