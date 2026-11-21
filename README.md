# Anatomy Notebook

A school-notebook-style web app for studying Anatomy. Notes are organised the way a real binder is, written in my own words, illustrated with pictures, and kept alongside the AI conversations that helped me understand them. It works offline, so I can review on my phone without signal.

I built it for my own B.Sc. Anatomy studies at the University of Port Harcourt, because no note-taking app handled three things together: deep nesting, saved AI chats that stay readable, and offline use on a phone.

## What it does

**A binder that nests as deeply as the subject needs**
Courses hold topics, and topics hold more topics. *Micronutrients → Vitamins* and *Micronutrients → Minerals* are separate notes, stored and opened separately. There is no fixed number of levels. Folders can be coloured, reordered and moved.

**Notes in my own words**
A Write / Read / Split editor with study-friendly formatting:

| Write | You get |
|---|---|
| `==important==` | a highlighter mark |
| `> [!KEY] Title` | a boxed callout: `KEY`, `DEF`, `EX`, `TIP`, `WARN`, `EXAM`, `MISTAKE`, `NOTE` |
| `- [ ] revise this` | a tick box that can be ticked while reading |
| `[[Vitamins]]` | a link to another note |
| `![Brachial plexus](img:…)` | a captioned picture |
| `\| a \| b \|` | a ruled table |

**AI conversations as speech bubbles**
Paste a conversation from any AI chat and it renders as a multi-person exchange, with each speaker on their own side in their own colour.

````
```chat
Excel: Why do fat-soluble vitamins need fat to be absorbed?
Claude: Because they dissolve in fat, not water, so they travel inside tiny
fat droplets called micelles.
```
````

It handles two, three or more speakers, and pasted exports that use "You said:" and "Claude said:" labels.

**Made for revising on the move**
- Works fully offline; edits sync when the connection returns
- Installable on a phone home screen like a native app
- Search across every note and conversation (`Ctrl/⌘ K`)
- Star a note to have it appear under **Marked for review** on the home page
- Pictures are shrunk to WebP before upload, so they load quickly on mobile data
- Light and dark themes, with a plain-font option when the handwriting fonts are too much
- One-tap backup and restore of the whole notebook

## Tech stack

| Layer | Choice |
|---|---|
| Front end | Vanilla JavaScript, HTML and CSS. No framework and no build step |
| Notes formatting | A custom Markdown renderer written for this project (callouts, highlights, tasks, wiki links, chat bubbles) |
| Offline and local storage | IndexedDB, a service worker and a web app manifest (PWA) |
| Hosting | Cloudflare Pages |
| API | Cloudflare Pages Functions |
| File storage | Cloudflare R2, bound directly to the functions |
| Typography | Caveat and Patrick Hand for the handwritten feel, Nunito for body text |

There are no runtime dependencies and no npm packages in the app.

## How it works

```
 Phone / laptop                         Cloudflare
┌────────────────────┐   changed notes  ┌──────────────────┐        ┌──────────────┐
│ App (JS, local-first)│ ───────────────▶│ Pages Functions  │ ─────▶ │  R2 bucket   │
│ IndexedDB copy      │ ◀─────────────── │ login · sync ·   │ ◀───── │ notes + images│
│ Service worker      │   merged result  │ image            │        │ (private)    │
└────────────────────┘                   └──────────────────┘        └──────────────┘
```

**Local-first.** Every edit is saved in the browser first and sent to the cloud afterwards, so the app never waits on the network. An offline indicator shows what is pending.

**Safe merging across devices.** Each note carries a timestamp. When two devices have edited the same note, the newest edit wins. Deleting a note leaves a hidden marker, so a stale copy on another device cannot bring it back. The merge logic is a single shared file that runs in both the browser and the server, so both sides always agree.

**A private bucket.** The bucket is never public and the browser never talks to it directly. Every request goes through the API, which checks a signed, HttpOnly session cookie first. The server validates everything it receives before writing, so a bad client cannot corrupt the notebook.

**Cheap and quick storage layout.** The text of all notes lives in one small JSON document, which keeps syncing simple and makes search instant. Pictures are stored separately as individual objects. A dated backup of the notebook is written automatically the first time it is saved each day.

**A real notebook feel.** Cards sit on a 32px ruled-paper grid and their heights snap to it, so lines stay aligned across the page.

## Project structure

```
public/      the app: index.html, style.css, app.js, md.js (renderer),
             merge.js (sync rules), service worker, manifest, icons
functions/   the API: login, logout, sync, image, status
lib/         shared server code: auth, validation
test/        automated tests
```

## Testing

Automated tests cover the Markdown renderer, the server-side validation, the merge rules (including conflicts and deletions), and the API handlers. Browser tests drive the real app through two simulated devices, including editing offline and syncing afterwards.

## Deployment

The site deploys to Cloudflare Pages straight from this repository: `public/` is served as static files and `functions/` runs as the API. The R2 bucket is attached as a binding, so no storage keys appear anywhere in the code. A single password protects the notebook, since it is a personal tool.

## Roadmap

- Export a topic to PDF for printing before exams
- Flashcards generated from the **KEY** and **DEF** callouts in a note
- Optional multi-user mode, with each student getting their own private notebook

## Author

Built by **Excel Hephzibah Amadi** ([@Xcelsama](https://github.com/Xcelsama)), a self-taught web developer and Anatomy student in Port Harcourt, Nigeria.