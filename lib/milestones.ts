import "server-only";
import { getStore } from "./db";
import { BOOKS, SECTIONS } from "./bible";
import { sendToUser } from "./push";

/**
 * Tell the group when somebody finishes a section of the canon.
 *
 * Ten of these across a whole plan, which is why they are worth sending at all:
 * a notification for every chapter anyone reads would be unusable at a dozen
 * people, and this is rare enough to stay an event.
 *
 * Deduped per person per section through the meta store, so unticking and
 * reticking the last chapter of Malachi cannot announce it twice.
 */
export async function announceMilestones(planId: string, userId: string): Promise<void> {
  const store = getStore();
  const [reads, members] = await Promise.all([
    store.listReads(planId),
    store.listMembers(planId),
  ]);
  const actor = members.find((m) => m.id === userId);
  if (!actor) return;

  const mine = new Set(
    reads.filter((r) => r.userId === userId).map((r) => `${r.book} ${r.chapter}`),
  );

  for (const section of SECTIONS) {
    let complete = true;
    for (const name of section.books) {
      const book = BOOKS.find((b) => b.name === name)!;
      for (let c = 1; c <= book.chapters; c++) {
        if (!mine.has(`${name} ${c}`)) { complete = false; break; }
      }
      if (!complete) break;
    }
    if (!complete) continue;

    const marker = `milestone:${planId}:${userId}:${section.id}`;
    if (await store.getMeta(marker)) continue;
    await store.setMeta(marker, "1");

    const body =
      section.id === "whole-bible"
        ? `${actor.displayName} has finished the entire Bible. All 1,189 chapters.`
        : section.id === "old-testament"
          ? `${actor.displayName} has finished the Old Testament.`
          : `${actor.displayName} has finished ${section.label}.`;

    // Everyone but the person who did it: they already know.
    await Promise.all(
      members
        .filter((m) => m.id !== userId)
        .map((m) =>
          sendToUser(m.id, {
            title: "Someone just finished a section",
            body,
            url: "/",
            tag: `milestone-${section.id}`,
          }).catch(() => {}),
        ),
    );
  }
}
