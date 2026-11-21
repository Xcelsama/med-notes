# Anatomy Notebook

A school-notebook style web app for your anatomy notes. Courses → topics → notes, pictures, and saved AI conversations shown as speech bubbles. Works on your phone, even offline.

## How it stores things (the idea first)

| What | Where it lives | Why |
|---|---|---|
| Your notes and folder structure | One file, `notebook/doc.json`, in your R2 bucket | Text is small. One file keeps syncing simple and lets search work instantly. |
| Pictures | `notebook/images/<id>` in the same bucket | Pictures are big. R2 charges nothing for downloads. |
| A copy for offline | Your phone or laptop browser (IndexedDB) | So you can review with no signal. Changes sync when you are back online. |
| Daily safety copy | `notebook/backups/doc-<date>.json` in the bucket | Written automatically the first time you save each new day. |

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

### 4. Set your password

This is the password you will type to open the notebook. Make it long. The command asks you to type it, so it never sits in a file.

```
npx wrangler pages secret put NOTEBOOK_PASSWORD --project-name anatomy-notebook
```

Optional, but good to have: a second secret with any long random text, used to sign login cookies.

```
npx wrangler pages secret put SESSION_SECRET --project-name anatomy-notebook
```

Then run `npx wrangler pages deploy` once more so the new secrets take effect.

### 5. Check it worked

Open `https://anatomy-notebook.pages.dev/api/status` (use your own address).

| You see | It means |
|---|---|
| `{"cloud":true,"authed":false}` | Cloud mode is on. Open the app and sign in. |
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
| Mark something to revisit | ★ at the top. Marked notes appear on the home page under "Marked for review". |
| Link notes | Type `[[Vitamins]]` |
| Search everything | Magnifier, or `Ctrl/⌘ + K` |
| Back up | Settings → **Backup** (notes only; pictures live in R2) |

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
- It is a **single-user** app with one password. Do not share the password.
- Passwords are checked by the server and the login cookie is `HttpOnly`, but this is not a bank. Use a long password.
- The handwriting fonts (Caveat, Patrick Hand) load from Google Fonts the first time you are online, then work offline. **Settings → Text → Clean** switches to a plain font.

## Run it on your computer (optional)

```
cp .dev.vars.example .dev.vars     # then type a password after NOTEBOOK_PASSWORD=
npm run dev                        # http://localhost:8788
npm test                           # runs the automated tests (no Cloudflare account needed)
```

`npm run dev` uses a **local pretend R2 bucket** that lives in a `.wrangler` folder, so test notes never touch your real bucket.

## What is in the folder

| Path | What it is |
|---|---|
| `public/` | The app you see: `index.html`, `style.css`, `app.js`, `md.js` (note formatting), `merge.js` (sync rules), icons, offline worker, `_headers` |
| `functions/api/` | Five small server functions: `status`, `login`, `logout`, `sync`, `image` |
| `functions/_lib/` | Shared server code: login cookies, checks on incoming data, the sync rule |
| `wrangler.toml` | Connects your R2 bucket (the binding) and tells Pages to serve `public/` |
| `test/` | Automated tests, including a check that the server and browser sync rules always agree |
