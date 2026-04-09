import { v4 as uuidv4 } from 'uuid';
import {
  JiraChangelogEntry,
  JiraIssue,
  NormalizedEvent,
  EventType,
} from './types';

/**
 * Converts a raw Jira issue + changelog into a chronologically sorted list of
 * NormalizedEvent objects.  Only the fields relevant to SLA computation are
 * extracted: assignee, status, priority, and resolution.
 *
 * The returned list starts with an `issue_created` event whose `from` field
 * carries the initial status and priority as JSON
 * (`{ status: string, priority: string }`) so the engine can seed its state
 * without needing a separate argument.
 */
export function normalizeIssueEvents(
  issue: JiraIssue,
  changelogs: JiraChangelogEntry[],
): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];

  // The first event is always "issue created". Encode initial status+priority
  // in the `from` field as JSON so the engine can seed its initial state.
  events.push({
    eventId: uuidv4(),
    eventType: 'issue_created',
    timestamp: issue.fields.created,
    from: JSON.stringify({
      status: issue.fields.status?.name ?? '',
      priority: issue.fields.priority?.name ?? 'Medium',
    }),
    to: issue.fields.assignee?.accountId ?? null,
  });

  for (const entry of changelogs) {
    for (const item of entry.items) {
      const field = item.field.toLowerCase();

      let eventType: EventType | null = null;

      if (field === 'assignee') {
        eventType = 'assignee_changed';
      } else if (field === 'status') {
        eventType = 'status_changed';
      } else if (field === 'priority') {
        eventType = 'priority_changed';
      } else if (field === 'resolution') {
        eventType = item.to ? 'resolution_set' : 'resolution_cleared';
      }

      if (eventType) {
        const from =
          eventType === 'assignee_changed' ? item.from : item.fromString;
        const to =
          eventType === 'assignee_changed' ? item.to : item.toString;

        events.push({
          eventId: entry.id + '_' + field,
          eventType,
          timestamp: entry.created,
          from,
          to,
        });
      }
    }
  }

  // Sort chronologically; stable sort preserves insertion order for ties
  events.sort((a, b) => {
    const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    if (diff !== 0) return diff;
    // Creation events always come first on a tie
    if (a.eventType === 'issue_created') return -1;
    if (b.eventType === 'issue_created') return 1;
    return 0;
  });

  return events;
}
