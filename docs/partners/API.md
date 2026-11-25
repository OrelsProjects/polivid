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

UGC ads and talking avatars need a character: a person with a picture and a voice.

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
| `POST /videos/quote` | The same body as `POST /videos`, or `{ kind: "layout", videoId, style, media }`. Returns `{ credits }` and charges nothing. |
| `POST /videos` | Starts a video. Returns `{ id, credits, status: "queued" }`. |
| `GET /videos` | The user's recent videos |
| `GET /videos/:id` | `{ video }`. While `status` is `running`, `step` says what it's doing in words you can show as is ("Filming the video") and `progress` is 0–100. Once `status` is `succeeded`, `fileUrl` is a link that works for a day; copy the file to your own storage. |
| `POST /videos/:id/cancel` | Stops it and gives the credits back |
| `POST /videos/:id/layout` `{ style, media?, captions? }` | Re-edits a finished UGC or avatar video in a layout style, as a new video |

`POST /videos` bodies. Unknown fields are refused.

```jsonc
{ "kind": "ugc", "characterId": "…", "script": "…", "productKey": "…?", "direction": "…?", "format": "9:16", "tier": "pro", "captions": true }
{ "kind": "avatar", "characterId": "…?", "photoKey": "…?", "script": "…", "direction": "…?", "format": "9:16", "tier": "pro" }
{ "kind": "captions", "videoKey": "…" }
{ "kind": "faceless", "script": "…", "characterId": "…?", "direction": "…?", "format": "9:16", "tier": "pro" }
```

Field notes:
- **`tier`:** `low`, `pro`, or `ultra`.
- **`format`:** `9:16`, `16:9`, or `1:1`.
- **`direction`:** how it looks and moves, in the person's words. Nothing else is added.

Layout styles are `split-presenter`, `punch-in`, `source-reader` (needs a `post` upload), `framed-post`, `screen-demo` (needs a `recording` or `screenshot`), and `sketch-explainer`. Each `media` item is `{ key, role: post | screenshot | recording | picture, note? }`.

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
