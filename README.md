# Cadence — AI Calendar Assistant (Desktop)

A smart calendar app with an AI assistant that turns pasted emails into booked
events, plus reminders and email notifications. This package runs the full app
locally on your desktop (Windows, macOS, or Linux) — no internet connection to
a hosted server required, all your data stays on your machine.

---

## What you need installed first

Cadence is a Node.js app. You need **one** of these runtimes:

| Runtime | Install from | Why |
|---|---|---|
| **Bun** (recommended, faster) | https://bun.sh | Runs the app + installs dependencies in seconds |
| **Node.js 20+** | https://nodejs.org | Alternative if you can't install Bun |

Pick one and install it. To verify, open a terminal and run:
- `bun --version` (should print a version number), OR
- `node --version` (should print v20 or higher)

---

## Quick start (3 commands)

Open a terminal in this folder and run:

```bash
bun install
bun run db:push
bun run dev
```

Then open **http://localhost:3000** in your browser.

That's it — the app is running. Keep the terminal window open while you use it.

> **Node.js instead of Bun?** Replace `bun` with `npm` (or `pnpm` / `yarn`) in
> every command. For example: `npm install`, `npm run db:push`, `npm run dev`.

---

## One-click launchers (no terminal needed after the first install)

After you've run `bun install` once, you can use these double-click launchers:

### Windows
- Double-click **`start-windows.bat`**
- A console window opens showing the server logs
- Your default browser opens to http://localhost:3000

### macOS
- Double-click **`start-mac.command`** (or right-click → Open → Open anyway the first time)
- A Terminal window opens
- Your default browser opens to http://localhost:3000

### Linux
- Run `./start-linux.sh` in a terminal, OR
- Make it executable once: `chmod +x start-linux.sh`, then double-click in your file manager

---

## Install as a desktop app (native window, no browser chrome)

Once the app is running on http://localhost:3000:

1. Open http://localhost:3000 in **Google Chrome** or **Microsoft Edge**
   (Firefox and Safari don't support PWA install as well)
2. Click the **"Install app"** button in the right sidebar, OR
   use the browser menu → **Install Cadence** / **Install app**
3. Cadence now appears as a native desktop app:
   - Its own window with no browser chrome
   - A desktop shortcut / dock icon
   - Opens in its own window when you click the icon
   - Works even if you close your browser

On macOS, the installed PWA appears in Launchpad. On Windows, it appears in the
Start menu. You can pin it to your taskbar / dock like any other app.

---

## Mobile app + notifications (Android)

1. Find out your computer's local IP address:
   - **Windows:** `ipconfig` in Command Prompt → look for "IPv4 Address"
   - **macOS:** System Settings → Wi-Fi → Details → IP address, OR `ifconfig | grep inet` in Terminal
   - **Linux:** `ip addr show` → look for your `inet` address
2. Make sure your phone is on the same Wi-Fi network as your computer
3. On your Android phone, open Chrome and visit `http://YOUR_COMPUTER_IP:3000`
4. Tap the **"Install app"** button, OR browser menu → **Add to Home screen**
5. Open the installed app, tap **"Enable push notifications"** → allow
6. Tap **"Send test push"** to verify — you should get a native Android notification

Now reminders will fire as native notifications on your phone, even when the
app is in the background (as long as your computer is running the server).

> **Note:** for mobile notifications to work, your computer must stay on and
> running the Cadence server. If you shut down your computer, reminders won't
> fire until it's back on. For always-on reminders, deploy the app to a cloud
> host (Vercel, Railway, Render) — see "Going further" below.

---

## How to use Cadence

### First: configure the AI provider (required, free, 1 minute)

The AI assistant needs an AI provider to parse pasted text. The app defaults
to **Groq** (free, fast) but needs an API key.

1. Click the **gear icon** (⚙️) in the top-right of the app → **AI Provider** tab
2. The default provider is **Groq (recommended, free)** — click the
   **"Get a free key"** link to open https://console.groq.com/keys
3. Sign in with Google or GitHub, click **"Create API Key"**, copy it
4. Paste the key (starts with `gsk_`) into the **API key** field
5. Click **"Test connection"** — you should see
   `✓ OK — groq / llama-3.3-70b-versatile responded with: "ok"`
6. Click **"Save AI settings"**

You can also use **Google Gemini** (free, 15 req/min), **OpenRouter** (free
models available), or **Ollama** (run models locally, 100% free, no internet).
See the AI Provider tab for details on each.

> **Why is this needed?** The app originally used the Z.ai SDK, which only
> works inside the Z.ai sandbox. When you run Cadence on your own machine,
> you need to provide your own AI provider. Groq's free tier is the fastest
> and easiest option.

### The AI assistant (main feature)
1. Paste an email, chat message, or meeting invite into the **AI Assistant**
   panel on the right
2. Click **"Analyze & check calendar"**
3. The AI extracts the event details (title, date, time, timezone, location)
   and checks your calendar for conflicts
4. **Review the editable form** — fix anything that looks wrong (especially
   the timezone conversion)
5. If there's no conflict, click **"Confirm & book it"**
6. If there IS a conflict, you'll see the conflicting events — choose
   **"Book anyway"** or edit the time and click **"Re-check calendar"**

### Calendar
- Click any day on the month grid to see that day's events
- Click **"New event"** in the header to add one manually
- Click an event in the day list to edit it
- Click the trash icon next to an event to delete it (with confirmation)

### Reminders
- Each event has a reminder (default 15 minutes before, configurable)
- When a reminder is due, you'll see an in-app toast AND a browser notification
  (if you've enabled notifications)
- If you've installed the PWA and enabled push, the reminder fires as a native
  system notification

### Email reminders (optional)
1. Click the **gear icon** in the header → Email Settings
2. Pick your email provider (Gmail, Outlook, etc.) and enter credentials
3. For Gmail: enable 2FA, then generate an App Password at
   https://myaccount.google.com/apppasswords — use that 16-character password
   (NOT your regular Gmail password)
4. Add an email recipient when creating an event
5. A reminder email is sent to that address 24 hours before the event

If you don't configure SMTP, emails go through Ethereal (a test service that
shows you a preview URL but doesn't deliver to real inboxes).

---

## Stopping the app

- Close the terminal / console window running the server, OR
- Press `Ctrl+C` in that terminal

Your events and settings are saved in `db/custom.db` and persist between runs.

---

## Troubleshooting

**"Port 3000 is already in use"**
Another app is using port 3000. Either close it, or edit `package.json` and
change `"dev": "next dev -p 3000 ..."` to a different port (e.g. 3001).

**"Cannot find module" errors**
Run `bun install` (or `npm install`) again in the project folder.

**Browser notification permission denied**
Click the lock icon in your browser's address bar → Site settings →
Notifications → Allow.

**PWA install button doesn't appear**
Use Chrome or Edge. Firefox has limited PWA support. Safari on Mac doesn't
support installing PWAs from localhost reliably.

**Database schema errors after updating**
Run `bun run db:push` to sync the database schema, then restart the server.

---

## Going further: deploy to the cloud (always-on)

If you want Cadence accessible from anywhere (not just when your computer is
on), deploy it to a cloud host:

1. **Vercel** (free tier, easiest for Next.js):
   - Push this folder to a GitHub repo
   - Import the repo at vercel.com
   - Add the environment variables from `.env` in the Vercel dashboard
   - Note: Vercel is serverless, so the local SQLite DB won't persist — you'll
     need to switch to a real database (PostgreSQL via Prisma is easiest; see
     https://www.prisma.io/docs/concepts/database-connectors/postgresql)

2. **Railway / Render** (better for SQLite, since they support persistent disks):
   - Connect your GitHub repo
   - Set the `DATABASE_URL` environment variable
   - Deploy

Once deployed, install the PWA from your cloud URL on any device.

---

## Project structure

```
cadence/
├── prisma/schema.prisma        # Database schema (Event, Reminder, Setting, PushSubscription)
├── src/
│   ├── app/
│   │   ├── page.tsx            # Main calendar UI
│   │   ├── layout.tsx          # Root layout, PWA manifest, service worker registration
│   │   └── api/                # All API routes (events, reminders, AI parse, email, push)
│   ├── lib/
│   │   ├── ai-parser.ts        # Z.ai SDK call to parse pasted text into event JSON
│   │   ├── calendar.ts         # Conflict detection + reminder scheduling
│   │   ├── email.ts            # SMTP / Ethereal email sending
│   │   ├── push.ts             # Web-push broadcast to subscribed devices
│   │   └── db.ts               # Prisma client
│   ├── components/             # React UI components (calendar, AI panel, settings, PWA)
│   └── hooks/                  # React hooks (events, reminders, push subscription)
├── public/
│   ├── manifest.webmanifest    # PWA manifest
│   ├── sw.js                   # Service worker (caching + push notifications)
│   └── icon-*.png              # App icons
├── package.json
└── .env                        # Database URL + VAPID keys for push
```

---

## Tech stack
- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS 4** + shadcn/ui components
- **Prisma** ORM + **SQLite** database
- **Z.ai SDK** for the AI assistant (GLM model, no API key needed)
- **Nodemailer** for email (SMTP or Ethereal test mode)
- **web-push** for mobile/desktop push notifications
- **PWA** (manifest + service worker) for installable desktop + Android app

---

## Privacy
All your data — events, settings, email credentials, push subscriptions — is
stored locally in `db/custom.db` on your machine. Nothing is sent to any server
except:
- The Z.ai API (to parse pasted event text — only the text you paste)
- Your SMTP server (when sending reminder emails)
- The web-push service (FCM on Android, Mozilla's service on Firefox) to
  deliver push notifications to your devices

If you don't want to use the AI assistant, you can create events manually with
the "New event" button — no text is sent to Z.ai in that case.
