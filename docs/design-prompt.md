# Design Brief: Thor → a real home automation hub

> Paste this prompt into a fresh Claude session (with the `design` skill / agent active). The agent has no memory of the codebase or the conversation that produced this brief — everything it needs is below.

---

## Your role

You are designing the next generation of **Thor**, a self-hosted home automation hub. Today it controls Philips WiZ light bulbs on the local network. The product is going to grow into a full home-automation platform. I want you to produce a design that survives that growth — information architecture, key flows, screen wireframes, a component vocabulary, and a visual language — without locking us in to today's narrow scope.

Treat this as a real product-design exercise: ask clarifying questions when assumptions matter, propose tradeoffs, and prefer a smaller set of strong recommendations over a buffet of options.

## What Thor is today

A single-tenant smart home server running on a Raspberry Pi at someone's home. One server = one home. The current capability set:

- **Lights**: discover, add to rooms, turn on/off, change scenes (Warm white, Cozy, Ocean, Party, …), brightness, color temperature, color picker. WiZ over UDP on the LAN.
- **Rooms**: a flat list of named rooms; each room contains 0..n devices.
- **Auth**: JWT-based, with a root user and invited users. Root can create/delete users and reset passwords; users can change their own. All users see the same rooms (one home, shared state).
- **Discovery**: button-triggered LAN scan; results shown in an "Add IoT Devices" panel per room.
- **Topology**: PWA-friendly React 19 + Tailwind frontend, served same-origin by an Express backend on the Pi, fronted by Cloudflare for HTTPS + edge caching. The backend exposes a small REST API (`/auth/*`, `/api/rooms`, `/api/lights/*`, `/api/discover`, `/api/network`, `/health`).

To ground yourself in the current UI, read these files in the repo (do not redesign them — read them to understand the existing mental model and what users have learned to expect):

- `frontend/src/components/RoomManager.tsx` — the dominant screen today; lists rooms, devices, the discover/add panel.
- `frontend/src/components/SceneSelector.tsx`, `ColorBrightnessControl.tsx`, `TemperatureControl.tsx`, `RoomColorControl.tsx`, `RoomTemperatureControl.tsx`, `PowerControl.tsx`, `DeviceControls.tsx` — the controls that exist today.
- `frontend/src/components/LoginPage.tsx`, `MustChangeBanner.tsx`, `ChangePasswordModal.tsx`, `ManageUsersModal.tsx` — the current auth surface.
- `frontend/src/types.ts`, `frontend/src/shared-types.ts` — the data model.
- `frontend/tailwind.config.js` — the current design tokens (such as they are).

The current visual language is a generic dark dashboard: zinc/slate backgrounds, accent blues and greens, dense card grids, ad-hoc spacing. It works, but it doesn't have a strong point of view, and it was sized for one connector and one room concept.

## Where Thor is going

Four big shifts. Design for all four; don't treat them as separate apps.

### 1. PWA-first

The web app becomes an installable PWA that lives on the user's home screen. It must:

- Look and feel native on iOS and Android — bottom nav or large tappable surfaces, no hover-only interactions, big touch targets, gesture-aware (swipe to delete a device, long-press a tile to edit, pull-to-refresh).
- Work offline for what it can: render the last-known device states, queue commands when the LAN is unreachable, surface a clear "offline" banner instead of silent failure.
- Handle install + permissions gracefully: a thoughtful first-run that requests notifications and microphone access only when the user reaches the feature that needs them, never up-front.
- Look correct on a desktop browser too, but the desktop layout is secondary — the design starts on a phone.

### 2. AI assistance is a first-class surface

The user can ask the home anything in natural language, and it does the right thing. Examples:

- "Turn off all lights downstairs."
- "Dim Avinash's room to 20% and switch to ocean scene."
- "Why did the kitchen lights flicker yesterday at 9pm?"
- "Set up an automation: at sunset, warm light in the living room and bedroom; at 11pm, everything off."
- "Suggest a scene for movie night."

Design the AI as a primary entry point, not a hidden chat behind a button. It should be at least as discoverable as the rooms list. It also produces non-prompted output: proactive suggestions ("you usually turn the bedroom on at this time — want me to schedule it?"), explanations of what just happened, and confirmations when an automation triggers.

The AI surface needs to handle:

- A conversational input (text, voice via mic).
- Mixed responses: text + interactive cards (a device control inline in the chat, a confirm-this-automation card, a chart of historic energy use).
- Trust: every AI-driven action is reviewable and reversible. The user must be able to see "what did the AI do for me today" and undo it.

### 3. Ambient control: clap-based triggers from the PWA

The PWA, when installed and granted mic access, can passively listen for clap patterns and trigger user-defined actions:

- 2 claps → toggle current room's lights
- 3 claps → "movie mode" scene
- Custom patterns the user can record and bind

Design the discovery, configuration, and consent flow for this. It involves real friction (the user has to grant mic permission, leave the PWA running, trust that the audio isn't leaving the device) and the design has to make the privacy story obvious. Also account for failure: how does the user know if it's listening, if it's heard a clap, if a pattern matched but the action failed?

The clap surface is one example of *ambient* control. Future ambient channels (presence, voice wake-word, time-of-day, geofence) should fit the same UX pattern.

### 4. Multi-protocol, multi-connector

WiZ is the first connector. Coming soon: Philips Hue, Matter, Zigbee (via a USB dongle), TP-Link Kasa, generic MQTT, smart plugs, sensors (motion, door, temperature, humidity), cameras, speakers, locks. Some are LAN, some are cloud-relayed, some need a hub. The user must be able to:

- See all connectors and their status (connected, paired devices, last sync, errors).
- Add a new connector type from a curated list, with per-connector setup flows that vary widely (WiZ is auto-discovery; Hue needs a Bridge IP + button-press; Matter is QR-code pairing; MQTT needs broker config).
- Manage device taxonomy across connectors: a "light" from Hue and a "light" from WiZ should feel like the same kind of thing in rooms, scenes, and AI commands. The design has to abstract over the protocols.
- See what each connector exposes and what capabilities a given device has (on/off, dimming, color, temperature, energy, motion event, …).

## What I want from you

Produce a design package, in this order. Stop and ask me questions where you need to.

### A. Strategy and assumptions (text)

- A 1-page strategy summary: who is the primary user, what is the core promise, what are the 3 to 5 design principles that should resolve disputes ("we always favor X over Y").
- Explicit list of assumptions you're making about constraints I haven't told you (audience size, device count per home, technical literacy, etc.) and flag the ones that would change the design materially.

### B. Information architecture

- A sitemap of the PWA — every primary surface, with a one-line "this is for…" description.
- Justification for the chosen top-level navigation. Is it 3 tabs, 5 tabs, a left drawer, a hub-and-spoke from a "home" screen? Defend the decision in 2-3 sentences.
- Where does the AI live? Where does the connector manager live? Where do automations live?

### C. Key user flows (text + small diagrams ok)

Storyboard each of these end-to-end, calling out edge cases:

1. **First-run** — fresh PWA install, default root login, change password, add first connector, discover devices, group into rooms, succeed at a first action.
2. **Daily use, mobile** — the "I'm walking in the door, lights on" interaction. Should be 0-1 taps from home screen. Show how the PWA shortcuts and large-surface tiles support this.
3. **Add a new connector** that's not WiZ — design the variability (Hue button-press, Matter QR scan, MQTT form) without making each feel like a different app.
4. **Ask the AI to do something** that touches multiple devices across multiple rooms, including a clarifying question from the AI.
5. **Configure a clap pattern** — record, name, bind to action, test, save. Including the consent moment.
6. **Something went wrong** — a device is unreachable, an automation failed, a connector dropped. Where does the user discover this and recover?

### D. Screen wireframes (mid-fidelity)

Produce wireframes (ASCII / SVG / shadcn-pseudo-code / your choice) for at least these screens. Phone-sized first. Annotate them with what each region does and why.

- Home / dashboard
- Room detail
- Device detail (a light) — show how the design handles a device with capabilities the current UI doesn't, e.g. energy reporting from a smart plug
- AI chat / assistant
- Automations list and editor
- Connector list and connector detail (WiZ, Hue, Matter, generic)
- Add new connector flow (the "browse and pick a connector type" screen)
- Ambient settings (clap, presence) with permission state
- Activity / "what happened" view (AI actions, automation triggers, device events)
- Settings (users, profile, install state, notifications, data export)

For each wireframe, list the components it uses by name. Strive to reuse a small kit.

### E. Component vocabulary

A named, reusable component kit. For each component, give a 1-sentence purpose, the props that matter, the variants, and the empty/loading/error states. Include at minimum:

- Device tile (compact, comfortable, expanded)
- Scene tile
- Sensor reading
- Capability control (toggle / slider / picker / scene / multi-state) — these should be primitives that compose into the device-specific control panels
- Connector card
- AI message (user, assistant, action card, suggestion, error)
- Activity row
- Permission prompt
- Empty state
- Banner (offline, update available, AI suggestion)

### F. Visual language

- Recommend: keep the dark theme, evolve it, or replace it? Defend.
- Color tokens (primitive + semantic), type scale, spacing scale, radius scale, motion guidelines.
- A small mood-board reference set (existing apps that capture the feel — name 3 to 5 with what specifically you'd borrow).
- One full-color mock of the home screen and one of the AI screen, in light and dark mode, on a phone frame.

### G. Risks, tradeoffs, what I'd kill

A short section: where you made a call you're not 100% sure about, what you intentionally left out, what you'd want to test in a usability study before shipping.

## Constraints to design within

- The backend is one Express server on a single Raspberry Pi. Don't assume cloud GPU, real-time multiplayer, or unbounded compute. Some AI work will go to a hosted LLM via an outbound API; some can run on-device (later).
- Implementation will be React + Tailwind. You're free to assume shadcn/Radix-style primitives are available. Don't design things that require WebGL/canvas/native that we can't ship in 6 months.
- Multi-user, but every user sees the same home. Don't design per-user homes (yet). Do design per-user *preferences* (default rooms, notification settings, voice voice).
- Not building this for a designer audience — these are end users. Aesthetic, not industrial.
- Accessibility is non-negotiable: touch targets ≥44px, contrast WCAG AA, every action reachable without a hover, mic and notification flows narrated for screen readers.
- Internationalization: design with text expansion in mind, but content stays in English for v1.

## Deliverable format

A single Markdown response with the seven sections above, in order. Wireframes inline as ASCII or as descriptions of regions/positions/components. Visual mocks as SVG snippets or as descriptions detailed enough that I could hand them to a UI engineer and get something faithful.

If something I've asked for is wrong or under-specified, say so before producing the deliverable. I'd rather you push back than guess.
