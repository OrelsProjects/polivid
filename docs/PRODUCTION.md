# Productions

The Productions tool turns an idea, outline, or script into a planned and assembled video. Existing Create modes are unchanged.

## Default route (verified 2026-10-15)

| Stage | Default | Alternate |
|---|---|---|
| Extract | OpenRouter `anthropic/claude-haiku-5.5` | `openai/gpt-6-luna` |
| Develop / structure | `anthropic/claude-sonnet-5.5` | `openai/gpt-6.1-sol` |
| Escalate | `anthropic/claude-opus-5.5` | `openai/gpt-6-astra` |
| Frontier | `anthropic/claude-fable-5.1` | — |
| Storyboard images | `openai/gpt-image-2.5-flare` | `google/gemini-nano-banana-2.1` |
| Final reference images | `openai/gpt-image-2.5-sunburst` | same alternate |
| Video | Google `gemini-omni-1.1-flash` | OpenRouter Wan 3.0, Hailuo 3, Seedance 2.5 |
| Speech | ElevenLabs `eleven_v4` Text to Dialogue | — |
| Music | ElevenLabs `music_v2_5` | — |
| Ambience / SFX | `eleven_text_to_sound_v2` | — |
| Lip sync | Sync `sync-3` with `sync_mode=cut_off` | — |
| Review | `gemini-3.8-flash` | `gemini-4-argon` |
| Transcript | `scribe_v2` | — |
| Assembly | FFmpeg + Remotion timeline export | — |

Set `PLANNER_PROVIDER=openai` to switch the planner family. Override a task with `PLANNER_MODEL_DEVELOP`, `PLANNER_MODEL_EXTRACT`, and the other `PLANNER_MODEL_*` keys.

## Credentials

| Key | Used for |
|---|---|
| `OPENROUTER_API_KEY` | Planners, OpenRouter images and video, review if routed there |
| `GEMINI_API_KEY` | Omni video (default) and review fallback |
| `ELEVENLABS_API_KEY` | Speech, music, sfx, Scribe |
| `SYNC_API_KEY` | Lip sync |
| `OPENAI_API_KEY` | Optional image fallback |
| `PRODUCTION_PROVIDERS` | `mock` (default) or `live` |

`npm run verify:capabilities` checks which OpenRouter slugs are currently listed. Update `lib/production/capabilities/registry.ts` when a route changes.

## Limitations

- Mock mode is the default so development and tests do not spend credits.
- Omni does not accept standalone audio references, ignores reference-video audio, and a first-frame + extra refs + extension combo is rejected in preflight.
- A job interrupted during submit with no provider id becomes `needs_reconcile` instead of being paid for twice.
- Full-sequence extension responses replace earlier footage; they are not appended.
- Planned actions are stored separately from observations of what a clip actually contains.
- MP4 assembly currently compiles an editor timeline and marks the production ready; live Remotion export of production assets still uses the editor export path once an `EditProject` exists.

## Tests and eval

```bash
npm test
EVAL_BUDGET_USD=1 npm run eval:planners
```
