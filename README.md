# Med Notebook

A school-notebook style web app for your medical study notes. Courses → topics → notes, pictures, and saved AI conversations shown as speech bubbles. Works on your phone, even offline.

**New in this version:** built phone-first, **several people can sign in with their own name and password** (every note shows who saved it), and a **Study with AI** helper gives you a copyable prompt and turns the AI's reply into a note.

## How it stores things (the idea first)

| What | Where it lives | Why |
|---|---|---|
| Your notes and folder structure | One file, `notebook/doc.json`, in your R2 bucket | Text is small. One file keeps syncing simple and lets search work instantly. |
| Pictures | `notebook/images/<id>` in the same bucket | Pictures are big. R2 charges nothing for downloads. |
| A copy for offline | Your phone or laptop browser (IndexedDB) | So you can review with no signal. Changes sync when you are back online. |
| Daily safety copy | `notebook/backups/doc-<date>.json` in the bucket | Written automatically the first time you save each new day. |
| People and their passwords | `notebook/users.json` in the bucket | Names plus a scrambled (hashed) password each. The real password is never stored. |

Your bucket stays **private**. The browser never talks to R2 directly. It talks to this app's `/api` functions on Cloudflare Pages. Those functions reach your bucket through a **binding**, which is a connection Cloudflare sets up inside your own account. So there are **no API keys, no account ID and no CORS setup**. They check your password first.

When two devices change the same note, the **newer edit wins**. Deleting leaves a hidden marker, so an old copy on another device cannot bring a deleted note back.

## Put it online on Cloudflare (about 10 minutes)

Cloudflare's own tool, `wrangler`, uploads the project, so you do not need GitHub for this. You need Node 20.19 or newer.

### 1. Tell the app which bucket to use

Open `wrangler.toml` and replace the bucket name with the exact name of your R2 bucket:

```toml
bucket_name = "your-bucket-name"
```

Leave `binding = "BUCKET"` as it is. The code looks for that name.

### 2. Log in and create the project

Run these in the project folder. The first opens a browser window to sign in to Cloudflare.

```
npx wrangler login
npx wrangler pages project create anatomy-notebook --production-branch main
```

### 3. Deploy

```
npx wrangler pages deploy
```

It prints your address, which looks like `https://anatomy-notebook.pages.dev`.

### 4. Set the access code

`NOTEBOOK_PASSWORD` is now the **class access code**. It is not what people sign in with. It is what a new person types **once, to create their own account**. Give it only to people you want in the notebook. The command asks you to type it, so it never sits in a file.

```
npx wrangler pages secret put NOTEBOOK_PASSWORD --project-name anatomy-notebook
```

Optional, but good to have: a second secret with any long random text, used to sign login cookies. Without it, changing the access code signs everybody out.

```
npx wrangler pages secret put SESSION_SECRET --project-name anatomy-notebook
```

Then run `npx wrangler pages deploy` once more so the new secrets take effect.

### 5. Check it worked

Open `https://anatomy-notebook.pages.dev/api/status` (use your own address).

| You see | It means |
|---|---|
| `{"cloud":true,"authed":false,"setup":true}` | Cloud mode is on and nobody has an account yet. Open the app and create the first one. |
| `{"cloud":true,"authed":false,"setup":false}` | Cloud mode is on. Open the app and sign in. |
| `{"cloud":false,"missing":[...]}` | Those settings are missing. `BUCKET (R2 binding)` means the bucket name in `wrangler.toml` is wrong or the deploy did not read it. `NOTEBOOK_PASSWORD` means step 4 is not done. |

Until both are set, the app runs in **demo mode**: notes stay in that browser only. Nothing is exposed, because the API stays closed.

### If you would rather use the Cloudflare dashboard

Upload the folder in **Workers & Pages → Create → Pages**, or connect a GitHub repo. Then open the project's **Settings**:

| Setting | Value |
|---|---|
| Build output directory | `public` |
| Bindings → R2 bucket | Variable name `BUCKET`, pick your bucket |
| Variables and Secrets | `NOTEBOOK_PASSWORD` (Secret), optionally `SESSION_SECRET` |

If the dashboard shows these as locked, it is because `wrangler.toml` already defines them. Edit the file instead.

### Accounts, the admin, and "saved by"

1. Open the site. The first screen says **Create the first account**. Type your name, a password (6+ characters) and the access code. **The first account is the admin.**
2. Give friends the site address and the access code. They tap **Join** and make their own name and password. From then on they tap **Sign in**.
3. Every note remembers **who started it** and **who saved it last**. You see it on the note ("✍ Saved by Ada · 2 min ago · started by Excel") and on the lists. Starring or moving a note does not change "saved by", only real edits do.
4. **Admin tools** (tap your round avatar → **People**): reset someone's password or remove them. Their notes stay, still marked with their name.
5. Anyone can change their own password: avatar → **Change my password**. That signs their other devices out.

Notes saved **before** this version have no name on them. They simply show no "saved by" line until somebody edits them.

If **you** (the admin) forget your password, the other way in is to delete `notebook/users.json` from the bucket in the Cloudflare dashboard. The next person to open the app creates the first account again, and your notes are untouched.

### Your old notes

The file layout in the bucket is the same as before (`notebook/doc.json`, `notebook/images/...`). If you used the Vercel version with the same bucket, your notes and pictures are already there. Sign in and they appear.

### Your own domain (optional)

Your address is free and works well for an app on your home screen. To use your own domain later, open the project → **Custom domains**. The domain has to be on Cloudflare, or you can move its name servers there.

### Extra login protection (optional)

Cloudflare Zero Trust **Access** can put an email-code login in front of the whole site. I have not tested this with the notebook. If you turn it on, you sign in twice (Cloudflare, then the notebook password). The password alone is fine for notes.

### Install it on your phone

Open the site in Chrome → menu → **Add to Home screen** (or **Install app**). It then opens like a normal app, full screen.

## Using it

| To do this | Do this |
|---|---|
| Add a course | **+** at the top of the binder, or the round **+** button |
| Group notes (Micronutrients → Vitamins, Minerals) | Open a folder → **New topic**. Topics can go as deep as you like. |
| Write a note | Open it → **Write**. **Read** is for studying, **Split** (wide screens) shows both. |
| Add a picture | Picture button in the toolbar, or paste a screenshot into the page. Text in `![caption](...)` becomes the caption. |
| Save an AI chat | Speech-bubble button → paste the chat → **Insert** |
| Turn an AI study chat into a note | **Study with AI** (see below) |
| Mark something to revisit | ★ at the top. Marked notes appear on the home page under "Marked for review". |
| Link notes | Type `[[Vitamins]]` |
| Search everything | Magnifier, or `Ctrl/⌘ + K` |
| Back up | Settings → **Backup** (notes only; pictures live in R2) |

### Study with AI (summary notes in 4 taps)

Use this when you have been studying inside an AI chat (Claude, ChatGPT, Gemini…) and want the whole chat as one clean note.

1. Tap **Study with AI** (home page card, the ✨ in the editor toolbar, the **+** button, or the sidebar). Pick the kind of note: **Summary note**, **Exam-ready** (adds mistakes, likely questions, a tick-box recall list) or **Quick recap**. Add a topic if you like.
2. Tap **Copy prompt**. Go to your AI chat, paste it at the end of the conversation and send.
3. The AI replies with the note inside one code block. Tap the copy button on that block.
4. Come back, tap **2 · Paste reply**, tap **Paste from clipboard**, check the preview, choose the folder, tap **Save as new note**. (Opened it from inside a note? **Add to this note** puts it at your cursor instead.)

The prompt teaches the AI this notebook's own formatting (headings, `==highlights==`, `> [!KEY]` boxes, tables, tick boxes), so the note looks right straight away. The app removes the code-block wrapper and any "Here is your note:" chatter, and uses the AI's `# Title` as the note title. The prompt text itself lives in `public/prompts.js` if you want to change the wording.

### Conversations (two or more people talking)

Write each speaker's name, a colon, then the text. Put the whole conversation inside a `chat` block:

````
```chat
Excel: Why do fat-soluble vitamins need fat?
Claude: Because they dissolve in fat, not water.
It travels in tiny droplets called micelles.
Dr Ada: I can add to that.
```
````

- A line starting with `Name:` begins a new bubble. Lines after it stay in the same bubble.
- **Excel** (also Me, You, User) is shown on the right in blue. **Claude** is terracotta, **ChatGPT** green, **Gemini** purple. Anyone else gets their own colour.
- If someone speaks only **once**, write `@Name:` (for example `@Dr Ada:`) so it is not mistaken for a normal word like "Note:".
- Pasting "You said:" / "Claude said:" works too. "You" becomes your name (change it in Settings).

### Extras in the notes

| Write | You get |
|---|---|
| `==important==` | a highlighter mark |
| `> [!KEY] Title` then `> text` | a boxed callout. Types: `KEY`, `DEF`, `EX`, `TIP`, `WARN`, `EXAM`, `MISTAKE`, `NOTE` |
| `- [ ] task` | a tick box you can tap in Read mode |
| a table with `\|` | a ruled table |

## Limits to know

- **The app limits one request to about 4 MB.** Pictures are shrunk to WebP (about 100-300 KB) before upload, so this never bites. The notes file would have to reach several MB of text before it did.
- **Free-plan CPU time (estimate, check Cloudflare's current limits):** each request gets a few milliseconds of processing. Syncing reads and writes the whole notes file, so a very large notebook (many MB of text) could one day hit that. If it does, the app shows a sync error, and the fix is a paid plan or splitting the notes file. A normal course's notes are far below this.
- It is **one shared notebook**: everyone who has an account sees and can edit every note. "Saved by" tells you who wrote what. It is not a way to keep notes private from each other.
- Passwords are checked by the server and stored only as hashes. The login cookie is `HttpOnly`. This is not a bank, so use a decent password. There is a short delay after each wrong try to slow down guessing, but no lock-out.
- **Free-plan note on passwords:** hashing a password takes CPU time, and the free plan allows only a few milliseconds per request. The app uses a moderate setting (30,000 rounds, about 6 ms here, an estimate: check Cloudflare's current limits). If sign-in ever fails with a Cloudflare "exceeded CPU" error on the free plan, lower `HASH_ITERATIONS` in `functions/_lib/users.js`. On a paid plan you can raise it to 100,000. Each account remembers the setting it was made with, so changing it never locks anyone out.
- After you deploy a new version, the service worker may show the old screen once. Open the site, wait a moment, and reload when it says **A new version is ready**.
- The handwriting fonts (Caveat, Patrick Hand) load from Google Fonts the first time you are online, then work offline. **Settings → Text → Clean** switches to a plain font.

## Run it on your computer (optional)

```
cp .dev.vars.example .dev.vars     # then type an access code after NOTEBOOK_PASSWORD=
npm run dev                        # http://localhost:8788
npm test                           # runs the automated tests (no Cloudflare account needed)
```

`npm run dev` uses a **local pretend R2 bucket** that lives in a `.wrangler` folder, so test notes never touch your real bucket.

## What is in the folder

| Path | What it is |
|---|---|
| `public/` | The app you see: `index.html`, `style.css`, `app.js`, `md.js` (note formatting), `prompts.js` (Study with AI), `merge.js` (sync rules), icons, offline worker, `_headers` |
| `functions/api/` | Small server functions: `status`, `login`, `register`, `account`, `logout`, `sync`, `image` |
| `functions/_lib/` | Shared server code: accounts and password hashing (`users.js`), login cookies (`auth.js`), who-saved-what (`authors.js`), checks on incoming data, the sync rule |
| `wrangler.toml` | Connects your R2 bucket (the binding) and tells Pages to serve `public/` |
| `test/` | Automated tests, including a check that the server and browser sync rules always agree |
