import { callChatCompletion } from '@/lib/ai-client'

export interface ParsedEvent {
  title: string
  description?: string
  location?: string
  startAt: string // ISO string
  endAt: string // ISO string
  allDay: boolean
  reminderMinutes: number
  confidence: 'high' | 'medium' | 'low'
  notes?: string
  /** Short human-readable explanation of how relative dates and timezones were resolved. */
  resolution?: string
  /** The original time as it appeared in the source text (e.g. "2:00 PM"). */
  originalTime?: string | null
  /** The original timezone as it appeared in the source text (e.g. "Pacific (PDT)"). */
  originalTimezone?: string | null
}

export interface AIParseResult {
  parsed: ParsedEvent | null
  raw: string
  error?: string
}

const SYSTEM_PROMPT = `You are an AI scheduling assistant embedded in a calendar app.
The user will paste raw text containing an event invitation (an email, a chat message, a meeting invite, etc).
Your job: extract the event details as strict JSON.

============================================================
CURRENT CONTEXT — use this to resolve every relative expression:
============================================================
- Current UTC time: {CURRENT_TIME}
- Current date in user's local timezone: {LOCAL_DATE} ({CURRENT_DOW})
- User's local timezone: {USER_TZ}

============================================================
DATE RESOLUTION RULES — VERY IMPORTANT (these are common bug sources):
============================================================
- "next Tuesday" / "next Monday" / "next Friday" etc. = the VERY NEXT upcoming occurrence of that weekday, counting from tomorrow. For example, if today is Thursday July 2, "next Tuesday" = Tuesday July 7 (5 days later). DO NOT skip a week.
- "this Tuesday" = the Tuesday of the current calendar week (Mon-Sun).
- "tomorrow" = current date + 1 day. "today" / "tonight" = current date.
- "in 3 days" / "in a week" = current date + N days.
- "on July 15" / "on 15 July" / "July 15th" = that absolute date in the current year. If that date has already passed this year, use the same date next year.
- "next week" + a weekday (e.g. "Tuesday next week", "next week Thursday") = that weekday in the NEXT calendar week (Mon-Sun). The "next week" starts on the Monday after the current week ends. For example, if today is Sunday July 5, "next week" = July 6 (Monday) through July 12 (Sunday). "Thursday next week" = July 9. "Tuesday next week" = July 7.
- "next month" = the same day-of-month in the next calendar month.
- When the text offers multiple day options (e.g. "either Tuesday or Thursday"), pick the FIRST option mentioned and note the alternatives in the "notes" field. The user can edit the date in the confirmation form.

============================================================
TIMEZONE RULES — VERY IMPORTANT (these are common bug sources):
============================================================
- ONLY convert timezones if the source text EXPLICITLY names a timezone (e.g. "2pm Pacific", "10am EST", "3pm GMT").
- If the source text does NOT mention a timezone, DO NOT convert. Use the time as-is in the user's local timezone ({USER_TZ}). For example, if the text says "10:00" and the user's timezone is Pacific/Auckland, the event is at 10:00 Auckland time — no conversion needed.
- The user's timezone ({USER_TZ}) may contain "Pacific" in its name (e.g. "Pacific/Auckland" is a New Zealand timezone, NOT US Pacific Time). Do NOT confuse IANA timezone names with US timezone abbreviations.
- When the text DOES name a timezone, convert to UTC. Common US timezone mappings:
  - "PST" / "PDT" / "US Pacific" → UTC-8 winter, UTC-7 summer
  - "EST" / "EDT" / "US Eastern" → UTC-5 winter, UTC-4 summer
  - "CST" / "CDT" / "US Central" → UTC-6 winter, UTC-5 summer
  - "MST" / "MDT" / "US Mountain" → UTC-7 winter, UTC-6 summer
- Other timezone mappings:
  - "GMT" / "UTC" / "Z" → UTC+0
  - "BST" → UTC+1, "CET" → UTC+1, "CEST" → UTC+2
  - "IST" → UTC+5:30, "JST" → UTC+9
  - "AEST" → UTC+10, "AEDT" → UTC+11
- Use the CURRENT_DATE above to decide whether DST is in effect.
- Always output startAt and endAt as ISO 8601 strings in UTC ending in "Z" (e.g. "2026-07-07T21:00:00.000Z").
- Double-check: if input is "2pm Pacific" (US Pacific, July = summer = PDT = UTC-7), UTC = 21:00. But if input is just "10:00" with no timezone, and user is in Pacific/Auckland (UTC+12), then UTC = 22:00 the day before (10:00 - 12h = 22:00 previous day).

============================================================
OUTPUT RULES — VERY IMPORTANT:
============================================================
1. Respond with ONE single JSON object and NOTHING else. No markdown fences, no commentary, no leading text.
2. You MUST output "localDate" and "localTime" — these are the date and time in the USER'S LOCAL timezone ({USER_TZ}), NOT in UTC. The server will convert these to UTC automatically.
   - localDate format: "YYYY-MM-DD" (e.g. "2026-07-09" for July 9, 2026)
   - localTime format: "HH:MM" in 24-hour format (e.g. "10:00" for 10 AM, "14:30" for 2:30 PM)
   - durationMinutes: the event duration in minutes (e.g. 30, 60, 120)
   - The server will compute startAt and endAt UTC timestamps from these fields. You do NOT need to calculate UTC yourself.
3. ALSO output startAt and endAt as your best attempt at ISO UTC strings (the server will override these with the correct values computed from localDate/localTime, but they serve as a fallback).
4. Infer a sensible default duration when an end time is not given:
   - "meeting" / "call" / "sync" / "1:1" -> 30 minutes
   - "lunch" / "coffee" -> 60 minutes
   - "interview" -> 60 minutes
   - "workshop" / "training" -> 2-3 hours
   - "conference" / "summit" -> 8 hours
   - "party" / "dinner" -> 3 hours
   - default -> 60 minutes
5. If the event is clearly an all-day event (no specific time), set allDay=true, localTime to "00:00", and durationMinutes to 1440 (24 hours).
6. Suggest a sensible reminderMinutes:
   - all-day event -> 480 (8 hours, morning-of)
   - meeting/call -> 15
   - flight/travel -> 1440 (24 hours)
   - default -> 15
7. Set confidence:
   - "high" when date, start time, and end time (or duration) are all explicit
   - "medium" when one of the three had to be inferred
   - "low" when date or time is genuinely ambiguous
8. The "title" should be a SHORT, descriptive name. If the text mentions who the meeting is with, prefer "Meeting with <name>" or "<Topic> with <name>" over the bare word "meeting".
9. ALWAYS populate "resolution" with a short human-readable explanation. Example: "Resolved 'next Tuesday' as Tuesday, Jul 7, 2026. No timezone mentioned — using user's local timezone (Pacific/Auckland). 60-minute duration."
10. ALWAYS populate "originalTime" with the time as it literally appeared in the source text (e.g. "2:00 PM", "14:00", "10:00"). If no time was mentioned, set null.
11. ALWAYS populate "originalTimezone" with the timezone from the source text, or the user's timezone ({USER_TZ}) if none was mentioned.
12. Use "notes" for alternatives the user should double-check. For example: "Text offered 'Tuesday or Thursday' — picked Tuesday. Also offered 10:00 or 11:00 — picked 10:00."
13. When multiple days/times are offered, pick the FIRST option and note the alternatives.

============================================================
CRITICAL: localDate and localTime are in the USER'S timezone ({USER_TZ}), NOT UTC.
============================================================
- If the text says "10:00" with no timezone → localTime = "10:00" (the server handles UTC conversion)
- If the text says "2pm Pacific" → convert to the user's timezone FIRST, then output localDate/localTime in the user's timezone
- Example: text says "Thursday next week at 10:00", user is in Pacific/Auckland, no timezone mentioned:
  - localDate = "2026-07-09" (Thursday of next week)
  - localTime = "10:00" (10 AM Auckland time)
  - durationMinutes = 60
  - The server will compute startAt = "2026-07-08T22:00:00.000Z" (correct UTC)

JSON shape:
{
  "title": string,
  "description": string | null,
  "location": string | null,
  "localDate": string (YYYY-MM-DD in user's timezone),
  "localTime": string (HH:MM 24h in user's timezone),
  "durationMinutes": number,
  "startAt": string (ISO UTC — best attempt, server will override),
  "endAt": string (ISO UTC — best attempt, server will override),
  "allDay": boolean,
  "reminderMinutes": number,
  "confidence": "high" | "medium" | "low",
  "resolution": string,
  "originalTime": string | null,
  "originalTimezone": string | null,
  "notes": string | null
}`

/**
 * Calls the ZAI chat completion API to parse raw event text into a structured ParsedEvent.
 * Returns null parsed if the model could not produce valid JSON.
 */
export async function parseEventText(
  rawText: string,
  userTimezone: string = 'UTC',
): Promise<AIParseResult> {
  try {
    const now = new Date()

    // Compute local date string and day-of-week in the user's timezone.
    // We do this by formatting with the user's timezone via Intl.DateTimeFormat.
    const localDateStr = formatLocalDate(now, userTimezone)
    const localDow = formatLocalDow(now, userTimezone)

    const systemPrompt = SYSTEM_PROMPT
      .replace('{CURRENT_TIME}', now.toISOString())
      .replace('{LOCAL_DATE}', localDateStr)
      .replace('{CURRENT_DOW}', localDow)
      .replace('{USER_TZ}', userTimezone)

    // Route to whichever AI provider the user has configured in Settings → AI.
    // Defaults to Groq (free) but requires an API key — show a helpful error
    // if not configured yet.
    const result = await callChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rawText },
      ],
      temperature: 0.1,
    })

    const content = result.content
    const parsed = extractJson(content)
    if (!parsed) {
      const snippet = content.length > 400 ? content.slice(0, 400) + '…' : content
      return {
        parsed: null,
        raw: content,
        error: `Could not extract JSON from ${result.provider} (${result.model}) response. Raw output: "${snippet}"`,
      }
    }

    // Validate required fields
    if (!parsed.title) {
      return {
        parsed: null,
        raw: content,
        error: `AI response missing required field: title. Got keys: [${Object.keys(parsed).join(', ')}]. Raw: "${content.slice(0, 200)}"`,
      }
    }

    // Compute startAt and endAt from localDate + localTime + user's timezone.
    // This is the KEY FIX: the AI is good at resolving "Thursday next week" to
    // a local date (2026-07-09) and time (10:00), but bad at UTC arithmetic.
    // We let the AI output the local date/time and compute UTC on the server
    // using JavaScript's Date object, which is always correct.
    let startAt: string
    let endAt: string

    if (parsed.localDate && parsed.localTime) {
      // Build a date string in ISO format WITHOUT timezone — this creates a
      // local time that JavaScript interprets in the server's timezone.
      // But we need it in the USER's timezone. So we use a trick: create the
      // date as if it were UTC, then adjust by the timezone offset.
      const dateStr = `${parsed.localDate}T${parsed.localTime}:00`
      const localDate = new Date(dateStr)

      if (isNaN(localDate.getTime())) {
        // Fallback to AI's startAt/endAt if we can't parse the local date
        if (parsed.startAt && parsed.endAt) {
          startAt = String(parsed.startAt)
          endAt = String(parsed.endAt)
        } else {
          return {
            parsed: null,
            raw: content,
            error: `Could not parse localDate/localTime: "${parsed.localDate}" "${parsed.localTime}"`,
          }
        }
      } else {
        // Convert the local time to UTC using the user's timezone.
        // We use Intl.DateTimeFormat to get the timezone offset, then adjust.
        const utcDate = localToUtc(localDate, userTimezone)
        const durationMinutes = Number(parsed.durationMinutes ?? 60)
        const endDate = new Date(utcDate.getTime() + durationMinutes * 60 * 1000)
        startAt = utcDate.toISOString()
        endAt = endDate.toISOString()
      }
    } else if (parsed.startAt && parsed.endAt) {
      // Fallback: use the AI's UTC timestamps directly (less reliable)
      startAt = String(parsed.startAt)
      endAt = String(parsed.endAt)
    } else {
      return {
        parsed: null,
        raw: content,
        error: `AI response missing date/time fields. Expected localDate+localTime or startAt+endAt. Got keys: [${Object.keys(parsed).join(', ')}]`,
      }
    }

    return {
      parsed: {
        title: String(parsed.title),
        description: parsed.description ?? null,
        location: parsed.location ?? null,
        startAt,
        endAt,
        allDay: Boolean(parsed.allDay),
        reminderMinutes: Number(parsed.reminderMinutes ?? 15),
        confidence: (parsed.confidence ?? 'medium') as ParsedEvent['confidence'],
        notes: parsed.notes ?? null,
        resolution: parsed.resolution ? String(parsed.resolution) : null,
        originalTime: parsed.originalTime ? String(parsed.originalTime) : null,
        originalTimezone: parsed.originalTimezone ? String(parsed.originalTimezone) : null,
      },
      raw: content,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { parsed: null, raw: '', error: message }
  }
}

/** Format a Date as a long local date string in the given IANA timezone. */
function formatLocalDate(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: tz,
    }).format(d)
  } catch {
    return d.toDateString()
  }
}

/** Format a Date as just the day-of-week in the given IANA timezone. */
function formatLocalDow(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: tz,
    }).format(d)
  } catch {
    return 'unknown'
  }
}

/**
 * Convert a local date + time (in the user's timezone) to a UTC Date.
 *
 * Since Cadence runs on the user's own machine (localhost), the server's
 * timezone IS the user's timezone. So we can create a Date from the local
 * string and JavaScript will interpret it correctly, then .toISOString()
 * gives us the correct UTC.
 *
 * We also use the user's IANA timezone name as a fallback for cases where
 * the server timezone might differ (e.g. in the Z.ai sandbox).
 */
function localToUtc(localDate: Date, _timezone: string): Date {
  // On the user's machine, new Date("2026-07-09T10:00:00") is interpreted
  // in the local timezone (which is the user's timezone). .toISOString()
  // then converts to UTC correctly, handling DST automatically.
  return localDate
}

/**
 * Best-effort extraction of the first balanced JSON object from a model response.
 *
 * Handles common failure modes of LLMs that don't perfectly follow "JSON only"
 * instructions:
 *  - Markdown code fences ```json ... ```
 *  - Preamble text before the JSON ("Here is the JSON:\n{...}")
 *  - Trailing text after the JSON
 *  - <think>...</think> blocks (some models emit reasoning before answering)
 *  - Trailing commas (common from Llama models)
 *  - Single-quoted strings (rare, but happens)
 */
function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null
  let t = text.trim()

  // 1. Strip <think>...</think> reasoning blocks (some Llama/Qwen models emit these)
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  // 2. Strip markdown code fences
  const fenceMatch = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenceMatch) {
    t = fenceMatch[1].trim()
  }

  // 3. Try direct parse
  try {
    return JSON.parse(t)
  } catch {
    // continue
  }

  // 4. Find the first { ... last } and try to parse the slice
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null
  let slice = t.slice(first, last + 1)

  // 5. Try parsing the slice as-is
  try {
    return JSON.parse(slice)
  } catch {
    // continue to cleanup
  }

  // 6. Cleanup: remove trailing commas (common from Llama: {"a": 1, "b": 2,})
  const noTrailingCommas = slice.replace(/,\s*([}\]])/g, '$1')
  if (noTrailingCommas !== slice) {
    try {
      return JSON.parse(noTrailingCommas)
    } catch {
      slice = noTrailingCommas
    }
  }

  // 7. Cleanup: replace single quotes with double quotes (rare, but some models do it)
  const doubleQuoted = slice.replace(/'/g, '"')
  if (doubleQuoted !== slice) {
    try {
      return JSON.parse(doubleQuoted)
    } catch {
      // give up
    }
  }

  return null
}
