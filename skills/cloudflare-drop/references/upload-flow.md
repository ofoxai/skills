# Cloudflare Drop — dropzone interaction, per browser backend

This is the detail behind step 4 of the main flow: **how to actually get the
folder/zip into the dropzone**, mapped onto whatever browser-automation surface
you have. The skill is backend-agnostic; pick the row that matches your tools.

## The dropzone, concretely

At `https://cloudflare.com/drop` the page is a single large dropzone: "drag a
folder or zip here". After you accept a terms dialog (first visit), it accepts the
files and deploys in seconds. The result view then shows:

- the live URL: `https://drop-{id}.{words}.workers.dev`
- a **Copy** button next to it
- a **Claim (59:xx)** countdown button + a **Copy claim link** control
- a **Deploy another** action

Under the hood the dropzone is backed by a hidden `<input type="file">` (with
`webkitdirectory`/`multiple` for folder support). **Setting that input's files is
the reliable upload path** — a simulated DOM "drag" of an OS file usually does
*not* work, because in-page drag primitives don't originate from the OS file
system.

## Backend mapping

| Backend | Reliable upload move | Notes |
|---|---|---|
| **claude-in-chrome** | `file_upload` targeting the dropzone's file input; pass the absolute path | Only works for files shared with the session. `upload_image` with a `coordinate` can drop onto a *visible* zone, but prefer the file input. |
| **Playwright** | `locator('input[type=file]').setInputFiles(path)` | For a folder, zip it first and set the zip — `setInputFiles` on a `webkitdirectory` input is unreliable across versions. |
| **Puppeteer** | `const input = await page.$('input[type=file]'); await input.uploadFile(path)` | Same folder caveat — prefer a zip. |
| **Selenium** | `driver.find_element(By.CSS_SELECTOR,'input[type=file]').send_keys(path)` | `send_keys` with the path is the canonical file-input upload. |
| **Generic `computer`/coordinate tool** | Click the dropzone → the OS file chooser opens → type/enter the path | You're driving the native picker, not a DOM drag. Slower, but works when you have no DOM access. |
| **Native OS file chooser (any)** | Handle the OS dialog: type the absolute path, confirm | Last resort; fragile across OSes. |

### If there is genuinely no file input

Some dropzones only wire up drag events. If (and only if) you can't find an
`<input type="file">`, fall back to a simulated drag with your backend's
drag/drop primitive onto the dropzone's coordinates — and expect friction. This is
the exception, not the default.

## Folder vs zip — which to upload

- **Single HTML file** → stage as `index.html` in a clean folder, then either
  upload the folder (if your backend does folders reliably) or **zip it and upload
  the zip** (most reliable across backends).
- **Multi-file site** → the folder must contain `index.html` at its root plus every
  referenced asset (CSS/JS/images/fonts). Zipping the whole folder and uploading
  the zip is the most portable move.
- **Why a zip is safer for automation**: folder-upload relies on `webkitdirectory`
  support in the file input, which several automation drivers handle poorly. A
  single `.zip` is just one file to `setInputFiles`/`send_keys`/`uploadFile`.

## Reading the result URL from the DOM (don't screenshot-read it)

After the deploy settles, read the exact URL string from the page rather than
transcribing it from an image:

```js
// Example (adapt selector to the live page):
// the live URL usually sits in a link or a readonly input near the Copy button
const el = document.querySelector('a[href*=".workers.dev"], input[value*=".workers.dev"]');
const url = el?.href || el?.value;   // -> https://drop-ab12.brave-lion.workers.dev
```

Identify success by the presence of a `*.workers.dev` URL. **No such URL on the
page = the drop did not succeed** → fail open (offer the file), never invent one.

Optionally also capture the **claim link** (from the "Copy claim link" control) so
you can offer the user a way to keep the deployment past 60 minutes.

## The 60-minute countdown

The result view shows `Claim (59:xx)` ticking down. That's the live window:

- **Share** the URL freely during the hour.
- **Claim** (sign in) to keep it — the claim link is portable, so the person who
  claims doesn't have to be whoever uploaded.
- **After 60 minutes**, an unclaimed drop expires and the URL stops resolving.

Always surface this expiry when you deliver the link (main skill, discipline #4).
