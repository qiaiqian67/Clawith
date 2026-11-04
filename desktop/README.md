# ZeroX desktop client

The desktop client of the ZeroX platform. It is an Electron application: the
main process owns the window and the data that stays on this computer, the
renderer owns the interface, and the preload bridge is the only path between
them.

## What the client is

- A **client** of a ZeroX server, not a copy of one. The server runs the
  agents; the client talks to it over HTTP and WebSocket.
- A **multi-server** client. The user can add several servers and switch
  between them. Each server keeps its own credential.
- The **same interface as the web app**, in a window of its own.

## Layout

```text
desktop/
  src/main/        Electron main: the window, the store, the OS adapters.
  src/preload/     The typed bridge from the main process to the renderer.
  src/renderer/    The React interface.
    src/shared/    The contract, the API client, the chat socket, the parser.
    src/brand/     The mark and its colour.
    src/features/  One folder per screen.
    src/i18n/      The message catalogs.
    src/styles/    The design tokens and the base layer.
  build/           The application icon.
  tests/           The contract tests and the live test.
```

## The screens

The screens are a sequence, and each one decides whether the next one shows.

0. **The server.** The first screen of a new installation asks for the address
   of the server, and checks that the client can reach it. Without this screen
   the client would only ever talk to a server on the same computer.
1. **The language.** A wheel with one language in the centre. The choice is
   stored in the desktop preferences.
2. **The sign-in.** The email, then a one-time code, and a link to create an
   account. The first account on a server becomes the platform administrator;
   a later one waits for an administrator to activate it, or needs an
   invitation code when the server asks for one.
3. **The first run.** One question, then the client opens.
4. **The workspace.** The server rail, the sidebar with the agents, their
   sessions, and the groups, and the chat in the middle.

## The panel of an Agent

The chat has a header, and the header opens the panel of the Agent. The panel
has four tabs.

- **Settings.** The name, the role, the welcome message, the primary and the
  fallback model, the budgets, the heartbeat, and the access of the Agent.
- **Files.** The workspace of the Agent: a directory list, an editor for the
  text files, and the download of the other ones.
- **Knowledge.** The long-term memory of the Agent, which is a file of its
  workspace, and the experience library of the organization.
- **Automation.** The triggers that wake the Agent and the schedules that run
  an instruction on a cron expression.

## The chat

The chat is a durable conversation, not a request and a response.

- The server owns the truth. The client reads the sessions and the messages
  over HTTP, and receives the live events over the socket.
- Every event carries a position. A client that reconnects asks for the
  events after the last position it saw, so it loses nothing.
- One session holds at most one Run. The client refuses a second message
  while one is in flight, and attaches to the Run that holds the lane when
  it opens on a session with work in progress.
- The messages the server stored replace the streamed ones as soon as the
  server has them, so the interface never shows a message the server did not
  store.
- The answer is Markdown. The parser turns it into blocks, and the interface
  draws them. Nothing is rendered as HTML, so a message cannot inject markup.
- A file goes into the workspace of the agent before the message is sent, so
  the agent reads it from its own files. A file dropped on the chat is the
  same upload as the one from the picker.
- An image inside a message is drawn, and the marker that carries it stays
  out of the text.
- A message can be searched for and copied.
- An answer that arrives while the window is in the tray also goes to the
  system as a notification.

## The groups

A group is a shared conversation of people and Agents.

- The server owns the group, its sessions, its members, and its messages.
- The client creates a group, invites or removes a member, and reads the
  messages.
- A group pushes its committed messages on its own socket, and the client
  keeps the membership fresh with a ping.
- One group session is one conversation; a group starts with none, so the
  client starts the first one.

## The shape of the client

The client is one rail and one card, the way the reference product is.

- The rail is 56 pixels wide and holds the whole map: the organization at
  the top, the views in the middle, and the account at the foot.
- The page is one rounded card that floats above the canvas. Nothing else
  has a border of its own.
- There is no second column of icons. The rail is the only navigation.

The views are the workbench, the assistants, the messages, the tasks, the
triggers, the plaza, the OKR, the organization, and the administration.

## The window

The client is a desktop application, not a page in a frame.

- Closing the window hides it in the tray, so an answer can reach the user
  while the window is away. The tray menu opens it again, and quits.
- A second launch brings the first window forward instead of starting a
  second copy.
- The window opens where it was left, unless that place is no longer on a
  screen.
- The menu carries the standard shortcuts: copy, paste, undo, zoom.
- The appearance follows the choice of the user, and the system while the
  choice is `system`.

## The update

The update runs in the main process, because it needs the file system and the
network of the application. The renderer asks, and a banner offers the
download. A development run has no release feed, so the service answers that
there is nothing to install.

## The rules of this project

- **One owner per fact.** The servers and the preferences live in the main
  process store. The interface reads them through the bridge. Neither one
  keeps a second copy.
- **The renderer never touches the operating system.** It asks the main
  process. The bridge carries no business rule.
- **The window keeps its sandbox.** `contextIsolation` is on, `sandbox` is on,
  and `nodeIntegration` is off. A link opens in the browser, and the renderer
  never navigates away from its own page.
- **A credential never enters the plain store.** It is encrypted with the
  operating system key store when one is there.
- **No text is a literal.** Every string a user reads is a key in the message
  catalogs, in both languages.
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

## Releasing

`RELEASING.md` explains the certificate and the update feed in plain words,
and what a user sees when the build has neither. Run `npm run package` and the
script prints the files it made and what is missing.

## Commands

```bash
npm install          # install the dependencies
npm run dev          # run the client with the renderer hot reload
npm run build        # build into out/
npm run typecheck    # type check both projects
npm run lint         # lint the renderer
npm test             # the contract tests
npm run test:e2e       # the live test of the chat
npm run test:e2e:group # the live test of a group
npm run test:e2e:agent # the live test of the administration of an Agent
npm run package       # build and package for this system
npm run package:win   # package for Windows
npm run package:mac   # package for macOS
npm run package:dir   # the unpacked directory, no installer
```

The live test needs a server, a mail catcher and a model stub. The guide for
a local run is in `backend/tools/README.md`.
