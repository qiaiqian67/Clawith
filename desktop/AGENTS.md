# AGENTS.md - ZeroX desktop client

## Purpose

The desktop client of the ZeroX platform. It talks to a ZeroX server; it
does not contain one. The server owns the agents, the runtime, and the data.
The client owns the window, the interface, and the facts that stay on this
computer.

## Layers

```text
renderer  ->  preload bridge  ->  main process
```

- The renderer never imports Electron, Node.js, or the main process. It asks
  through the bridge and reads plain serialisable values back.
- The preload carries no business rule. It maps a typed call to a channel.
- The main process owns the store, the window, and the operating-system
  adapters. It validates the input of every channel before it acts on it.

## The chat

The chat is a durable conversation. Three facts own it.

- The **server** owns the truth about a conversation: the sessions, the
  messages, and the Run that holds a session lane. The client reads that
  truth and sends intents.
- The **socket** owns one connection and its reconnection. Every event
  carries a position, so a reconnection asks for the events after the last
  position the client saw.
- The **hook** owns the turns of the interface. The stored messages replace
  the streamed ones as soon as the server has them.

A component does not open a socket, does not build a URL, and does not read
the run state. It uses the hook.

## Rules

- **One owner per fact.** The servers and the preferences live in the main
  process store. Nothing in the renderer keeps a second copy of them.
- **The window keeps its sandbox.** `contextIsolation`, `sandbox`, and
  `nodeIntegration: false` stay on. A new window opens in the browser, and
  the renderer never navigates away from its own page.
- **A credential is never in the plain store.** It is encrypted with the
  operating system key store when one is there.
- **No text is a literal.** Every string a user reads is a key in
  `src/renderer/src/i18n/messages/`, in both languages. A new key goes into
  both catalogs in the same change.
- **A design value is a token.** A colour, a size, a duration, or a layer that
  is not in `src/renderer/src/styles/tokens.css` has nowhere to go. A
  component does not declare a value of its own.
- **A screen is one folder.** `src/renderer/src/features/<screen>/` holds the
  component, its styles, and nothing else. A screen that needs another
  screen's state takes it as a prop.
- **A backend call names its path.** The chat API in
  `src/renderer/src/shared/chat-api.ts` and the API client in
  `src/renderer/src/shared/api-client.ts` resolve the path against the active
  server. A component does not build a URL.
- **A packet is narrowed by a helper.** `src/renderer/src/shared/chat-packet.ts`
  owns the reading of a packet. A component does not reach into an unknown
  packet.
- **A message is drawn, never interpreted.** The Markdown parser in
  `src/renderer/src/shared/markdown.ts` turns a message into blocks, and the
  interface draws them. Nothing in a message becomes markup.

## The modules

| Module | What it owns |
| --- | --- |
| `shared/contract.ts` | the shape of the data that crosses the bridge |
| `shared/api-client.ts` | the calls of the sign-in surface |
| `shared/chat-api.ts` | the calls of the chat surface |
| `shared/chat-contract.ts` | the shape of a session, a message, and a Run |
| `shared/chat-packet.ts` | the reading of a packet |
| `shared/chat-socket.ts` | the connection and its reconnection |
| `shared/use-chat.ts` | the turns of the interface |
| `shared/markdown.ts` | the blocks of a message |
| `shared/uploads.ts` | the upload of a file into the workspace |
| `shared/use-attachments.ts` | the files of a message, for the picker and the drop |
| `shared/notify.ts` | the notice of a finished answer |
| `shared/sessions.ts` | the creation of a session |
| `shared/uploads.ts` | the upload of a file into the workspace |
| `shared/message-images.ts` | the images a message carries |
| `shared/groups.ts` | the calls of the group surface |
| `shared/group-socket.ts` | the connection of one group |
| `shared/agent-admin.ts` | the calls of the administration of one Agent |
| `shared/agent-files.ts` | the calls of the workspace files of one Agent |
| `shared/agent-automation.ts` | the calls of the triggers and the schedules |
| `shared/experience.ts` | the calls of the experience library |
| `main/update-service.ts` | the release feed and the update |

## The groups

A group is a shared conversation of people and Agents.

- The server owns the group, its sessions, its members, and its messages.
- A group pushes its committed messages on its own socket, which is separate
  from the chat socket of one Agent.
- A group starts with no session. One session is one conversation, and the
  client starts the first one.
- A group message carries its tenant. Without it the tenant-scoped read
  filter cannot see the row, and the history stays empty.

## The shape of the client

`features/workspace/NavRail.tsx` is the only navigation, and
`nav-rail.css` owns the shell: `.zx-shell`, `.zx-rail`, `.zx-page`,
`.zx-page-card`. A view is a card that fills `.zx-page-card`.

A view that needs its own file lives in its own folder under `features/`, and
takes `baseUrl` and `token` so it reads the server itself.

## The transport

Every request goes through `shared/http.ts`, and every request is performed by
the main process through `zx:http`. The page runs on `app://`, which is an
origin of its own: a call the page made itself would be a cross-origin call,
and the server would have to allow that origin. The main process has no
origin, so a call reaches any server the user configured.

A module never calls `fetch` directly. It calls `apiRequest` or
`apiRequestText`, so a failure has one shape, a 401 returns the client to the
sign-in screen once, and the transport stays in one place.

## The window

The main process owns the tray, the menu, the place of the window, and the
single-instance lock. Closing the window hides it; the tray menu quits. A
second launch brings the first window forward.

## The panel of an Agent

The panel of one Agent has four tabs, and each tab is one folder under
`src/renderer/src/features/workspace/`.

- The **settings** read the Agent, the models, and the access, and write the
  fields the server accepts.
- The **files** read a directory of the workspace, write one text file, and
  download the others. A write carries the version the client read, so a
  change over a newer one is refused by the server.
- The **knowledge** edits the long-term memory, which is the file
  `memory/memory.md` of the workspace, and reads the experience library.
- The **automation** reads the triggers and the schedules, turns them on and
  off, and creates a schedule.

A tab never builds a URL. It uses the client of its surface, so the path of an
endpoint lives in one place.

## The update

The update runs in the main process, because it needs the file system and
the network of the application. The renderer asks, the main process answers,
and the banner offers the download. A development run has no release feed, so
the service answers that there is nothing to install.

## Checks

```bash
npm run typecheck        # both projects
npm run typecheck:node   # main, preload, shared
npm run typecheck:web    # renderer
npm run lint             # the renderer
npm test                 # the contract tests
npm run test:e2e         # the live test of the chat
npm run test:e2e:group   # the live test of a group
npm run test:e2e:agent   # the live test of the administration of an Agent
npm run build            # the bundle
```

Run the narrowest check that covers the change, one at a time. The live test
needs a server, a mail catcher, and a model stub; the guide for a local run
is in `backend/tools/README.md`.
