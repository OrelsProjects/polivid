# Partner API

A partner product (WriteStack) makes social videos for its own users, under its own name. Its users never sign up here: the first request for a user makes their account. Their videos are paid for by a monthly allowance the partner sets from its own plans.

Base URL: `https://<app>/api/partner/v1`. All bodies are JSON.

## Registering a partner

```
npm run partner:create -- writestack "WriteStack" "WriteStack" https://app.writestack.io/api/webhooks/video
```

This prints `VIDEO_PARTNER_SECRET` and `VIDEO_WEBHOOK_SECRET` once. Only a hash of the partner secret is stored. Running it again rotates both secrets.

## Signing requests

Every request carries:

| Header | Value |
| --- | --- |
| `Authorization` | `Bearer <VIDEO_PARTNER_SECRET>` |
| `X-Partner-User` | The partner's own user id (`[A-Za-z0-9_.:-]`, up to 64 characters) |
| `X-Timestamp` | Unix seconds. Requests more than 5 minutes off are refused. |
| `X-Signature` | Hex `HMAC-SHA256(secret, "{X-Timestamp}.{X-Partner-User}.{raw body}")`. The body is empty for a GET. |

A partner only ever reaches accounts it created. The user never comes from the body.

## Errors

Failures return `{ "error": { "code", "message", ... } }`. Branch on `code`. `message` is plain, names no product, and is safe to show users.

| Code | Status | Meaning |
| --- | --- | --- |
| `unauthorized`, `bad_signature` | 401 | Wrong secret, or the signature or timestamp doesn't match |
| `bad_user` | 400 | Missing or invalid `X-Partner-User` |
| `invalid` | 400 | The body is wrong. `message` says what. |
| `not_found` | 404 | No such video or character for this user |
| `conflict`, `not_ready` | 409 | Too many videos in progress (3 per user), already finished, or the source video isn't ready |
| `insufficient_credits` | 402 | Also carries `required` and `balance` |
| `rate_limited` | 429 | Over 60 requests a minute for one user |

## Credits

| Route | Does |
| --- | --- |
| `PUT /users/me/allowance` `{ credits, periodEnd, key? }` | Sets the user's video credits for the period. This replaces what's left; it doesn't add to it. Call it when a plan starts, changes, or renews. `key` (such as the Stripe event id) makes retries safe. |
| `GET /users/me/balance` | `{ credits, periodEnd }` |

A video holds its price when it starts and gives it back if it fails or is canceled. 100 credits = $1 of generation cost.

## Uploads

`POST /uploads/import` `{ url }` copies a public file (a picture under 4 MB, or a recording or clip under 20 MB) into the user's uploads and returns `{ key, kind, contentType, bytes }`. Pass keys, never links, to the routes below.

## Characters

UGC ads, talking avatars, and skits need a character: someone with a picture and a voice. A drawn character works too; it keeps its own art style.

| Route | Does |
| --- | --- |
| `GET /characters` | The user's characters |
| `POST /characters` | Creates one, see below |
| `GET` / `PATCH` / `DELETE /characters/:id` | Read, rename or describe, delete |
| `POST /characters/:id/pictures` `{ pictures: [{ key, label? }] }` | Adds up to 10 more pictures of the same person at a time, 24 in all. Free. |
| `PATCH /characters/:id/pictures/:pictureId` `{ label?, main?: true }` | Relabels a picture, or makes it the main one |
| `DELETE /characters/:id/pictures/:pictureId` | Removes a picture. If it was the main one, the next becomes main. The last picture can't be removed. |
| `GET /characters/voice-prompts` | The lines to read aloud, in order, for a recorded voice |
| `POST /characters/voice-previews` `{ description }` | Three voices designed from a description, each `{ generatedVoiceId, audio }`. Costs 1 credit. |
| `POST /characters/portrait` `{ description }` | A drawn portrait for someone with no photo, returned as `{ photoKey, pictureUrl }`. Costs 1 credit. |

`POST /characters` body:

```json
{
  "name": "Dana",
  "photoKey": "uploads/…/face.png",
  "pictureConsent": true,
  "voice": { "mode": "designed", "generatedVoiceId": "…", "description": "Warm, mid-30s, American, upbeat" },
  "description": "Optional appearance notes"
}
```

`voice` is one of:
- `{ "mode": "none" }`
- `{ "mode": "designed", "generatedVoiceId", "description" }`
- `{ "mode": "recorded", "sampleKeys": [one per voice prompt, in order], "consent": true }`

Both `pictureConsent` and a recorded voice's `consent` must be `true`. Show the person a checkbox for each.

### Pictures

A character comes back with `pictures: [{ id, label, main, url }]`. `label` is one of `face`, `profile`, `full_body`, `expression`, `outfit`, `other`.

More pictures make a UGC ad look more like the person. A UGC ad sends up to four: the main picture, then one per label (a face, then a side view, then a full-body shot), so different angles help more than several similar photos. A talking avatar speaks as the main picture only, so make the best front-facing photo the main one.

## Videos

| Route | Does |
| --- | --- |
| `POST /videos/quote` | The same body as `POST /videos`, or `{ kind: "layout", videoId, style, media }`, or `{ kind: "retry", videoId }`. Returns `{ credits }` and charges nothing. With a `finish`, it also returns `parts: { video, finish }`. |
| `POST /videos` | Starts a video. Returns `{ id, credits, status: "queued" }`. |
| `GET /videos` | The user's recent videos |
| `GET /videos/:id` | `{ video }`. While `status` is `running`, `step` says what it's doing in words you can show as is ("Filming the video") and `progress` is 0–100. Once `status` is `succeeded`, `fileUrl` is a link that works for a day; copy the file to your own storage. |
| `POST /videos/:id/cancel` | Stops it and gives the credits back |
| `POST /videos/:id/layout` `{ style, media?, captions? }` | Re-edits a finished UGC or avatar video in a layout style, as a new video. `captions` is `true`, `false`, or a caption style's id. |
| `POST /videos/:id/retry` | Tries a `failed` or `canceled` video again: the same request and finish, as a new video with its own credits. Returns 201 `{ id, credits, status: "queued" }`. Any other status is `409 conflict`. |
| `GET /videos/options` | The layout styles and caption styles to choose from, see below |

`POST /videos` bodies. Unknown fields are refused.

```jsonc
{ "kind": "ugc", "characterId": "…", "script": "…", "productKey": "…?", "direction": "…?", "format": "9:16", "tier": "pro", "captions": true, "finish": { … }? }
{ "kind": "avatar", "characterId": "…?", "photoKey": "…?", "script": "…", "direction": "…?", "format": "9:16", "tier": "pro", "finish": { … }? }
{ "kind": "captions", "videoKey": "…" }
{ "kind": "faceless", "script": "…", "characterId": "…?", "direction": "…?", "format": "9:16", "tier": "pro" }
{ "kind": "skit", "characterId": "…", "script": "…", "look": "auto?", "direction": "…?", "format": "9:16", "tier": "pro", "finish": { "captions": "comic" }? }
```

Field notes:
- **`tier`:** `low`, `pro`, or `ultra`.
- **`format`:** `9:16`, `16:9`, or `1:1`.
- **`direction`:** how it looks and moves, in the person's words. Nothing else is added.

### Skits

A skit is the character acting the script out instead of talking to camera: one short filmed shot per beat, with the whole body, props, and a new scene whenever the script calls for one. The character's own voice reads the script word for word over the shots. The character needs a picture and a voice (`400 invalid` otherwise).

- **Beats:** a note in `[brackets]` says what the character does and is never read aloud: `[Quill slips on a stack of papers] I never saw it coming. Three drafts, gone.` is one shot of the slip. A note steers every sentence up to the next note, unless that shot would run longer than the model films. Sentences before the first note, and a script with no notes, get a beat per sentence that shows the character acting out its line. A note at the end of a line steers the sentence before it. A very short line with no note is joined to its neighbour. A skit has at most 12 beats.
- **Look:** skits are drawn by default. `look` is one of:
  - `auto` (default): a character whose picture is a photo is drawn as a `retro-cartoon`; one that's already drawn (a cartoon, a mascot, a 3D render) keeps its own look.
  - `retro-cartoon`, `pixar` (rounded 3D), `claymation`, or `pixel-art`: the character is drawn in that look.
  - `own`: every shot is filmed from the character's pictures as they are, photo or drawing.

  A drawn character is drawn once, keeping who they are, and every shot is filmed from that one picture so they look the same in every beat. That picture is priced into the quote (about one credit); `auto` always includes it. `direction` goes on every shot, in the person's words.
- **Length and price:** each beat's shot runs about as long as its words take to say, at least 3 seconds. The video runs as long as its shots, and the quote is priced from them. `low` is the quickest and cheapest, `pro` has livelier motion, and `ultra` is the same as `pro`, sharper.
- **Sound and captions:** only the character's voice is kept; the shots' own sound is dropped. No captions are drawn on the shots. For captions, send a `finish` with a caption style. A skit takes a caption style but not a layout style (`400 invalid`), since layout styles re-cut one take of a speaker.

Layout styles are `split-presenter`, `punch-in`, `source-reader` (needs a `post` upload), `framed-post`, `screen-demo` (needs a `recording` or `screenshot`), and `sketch-explainer`. Each `media` item is `{ key, role: post | screenshot | recording | picture, note? }`.

### Finishing a video in one request

A UGC ad or talking avatar can say how it should be finished, so one request makes the finished video. A skit can take the caption style only:

```json
"finish": { "style": "punch-in", "media": [{ "key": "uploads/…/chart.png", "role": "picture" }], "captions": "yellow-pop" }
```

- **`style`:** a layout style. **`media`:** uploads it may show, only with a style. **`captions`:** a caption style's id, or `false` for none. Send a style, a caption style, or both.
- **Checks:** a style's needed upload, and that every upload is the user's own, are checked before anything is filmed.
- **Price:** the quote is the video plus an estimate for the finish, from the script's length. `POST /videos` refuses with `402` unless the balance covers both. The video's credits are held now; the finish's are held when it starts, from the finished video's own length.
- **What happens:** when the video succeeds, the finish starts by itself as a new video whose `parentId` is the first. A style lays it out (with the caption style, if one was sent). A caption style alone draws captions in that look. The first video is still delivered either way.
- **Tracking it:** every video view carries `finish`:

```json
"finish": { "style": "punch-in", "captions": "yellow-pop", "status": "started", "videoId": "…", "reason": null }
```

`status` is `waiting` while the video is made, `started` once the follow-up is queued (`videoId` is the new video), or `skipped`, with `reason` in plain words, when it couldn't start (for example, too few credits left). The webhook for the first video is sent after the follow-up is queued, so it already names it; the follow-up sends its own webhook when it ends. `finish` is `null` on a video without one.

### Options

`GET /videos/options` returns what a finish or re-edit can use:

```json
{
  "styles": [{ "id": "punch-in", "title": "Punch-in", "description": "…", "avatar": true, "needs": [] }],
  "captionStyles": [{ "id": "yellow-pop", "label": "Yellow pop", "categories": ["Business & ads", "Story", "Education"] }]
}
```

`avatar: false` means nobody is on camera. `needs` lists the upload roles a style needs, any one of which is enough.

### When a video fails

`error` on a failed video is always plain and safe to show. It says what to change when the writer can fix it (no speech to caption, a character with no picture, a picture or script turned down by the safety check, no face found). Otherwise it is `Something went wrong making this video. Your credits were returned.` Credits always come back for a failed video. `POST /videos/:id/retry` makes it again.

## Webhooks

When one of a user's videos succeeds, fails, or is canceled, we POST to the partner's webhook URL:

```json
{ "event": "video.updated", "userId": "<X-Partner-User>", "video": { "...same as GET /videos/:id" } }
```

The request carries these headers:
- `X-Timestamp`
- `X-Signature`: hex `HMAC-SHA256(VIDEO_WEBHOOK_SECRET, "{X-Timestamp}.{raw body}")`
- `X-Event-Id`: `{videoId}:{status}`, unique per change

Answer with any 2xx. Anything else is retried after 30 s, 2 min, 10 min, 30 min, and 2 h. Treat `X-Event-Id` as already handled if you've seen it. `GET /videos/:id` works as a fallback.
