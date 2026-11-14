# Tool catalog

Generated from `lib/tools`. Do not edit by hand. Run `npm run tools:docs` after changing a tool.

Each entry is what the Coach is told, plus the inputs and an example. Legacy tools are omitted.

## Make

### make_prompt_video

**Prompt to Video.** Generate a unique clip directly from a text prompt.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They want a filmed clip from a description, with no upload required.
- Optional reference pictures can lock a person or a look. Copy attached picture keys into referenceKeys.
- A character with a voice is added after filming as its own Voiceover clip. The footage itself has no voiceover. Pass characterId.
- Write the video prompt as numbered beats, one action each, in order. Do not describe later beats inside an earlier one.
- Pass vo as the brief's spoken lines, one beat per line. Pass none when the brief has no voiceover.
- When a brief lists frames:, pass those keys as referenceKeys in the same order.
- To control the shots yourself, pass cuts (seconds and camera per shot, from make_storyboard scenes). Otherwise clips sets only the shot count.

Don't use when:
- They pasted a script to be spoken. Use make_voiceover_video.
- They pasted lyrics. Use make_lyrics_video.
- They want a multi-scene film with dialogue control. Use start_production.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | yes | What to film. Numbered beats, one action each, in order. |
| format | yes | Frame. 9:16 for Reels, TikTok, and Shorts. 1:1 for feeds. 16:9 for YouTube. |
| length | yes | Length in seconds, from 2 to 90. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| model | no | Footage model id from list_models. Overrides the model the tier would pick. Check its clip lengths, reference-picture support, and price in list_models first. |
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
| showText | no | Whether on-screen text and titles are allowed. Defaults to yes. |
| template | no | Template slug from list_templates, for this same mode. Recorded on the video; it does not change other settings. |
| clips | no | How many clips (shots) to film, 1 to 12. Omit to let the planner use the fewest the model needs. |
| cuts | no | Your own shot list, in order. Sets the number of shots and each one's length and camera, and skips the automatic planner. The seconds should add up to length. |
| brief | no | How to read the prompt. Only used together with cuts. |
| attachmentRoles | no | What each reference picture is: subject, person, product, location, storyboard, framing. Only used together with cuts. |
| characterId | no | Character id from list_characters: off, studio, or a saved character that has a picture. |
| referenceKeys | no | Upload keys for reference pictures of a person or a look. Copy keys from an attached-pictures note. |
| vo | no | Spoken lines, one beat per line. Pass none when the brief has no voiceover. |

Examples:

> A 15 second vertical clip of a cat on a roof at dusk.

```json
{"prompt":"A cat steps onto a tiled roof at dusk","format":"9:16","length":15,"tier":"pro"}
```

### make_voiceover_video

**Voiceover Video.** Turn a script or a link into a spoken video with an AI voice.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They have a script, or a link's worth of words, that should be spoken over footage.
- Aim for 150–170 spoken words per minute. Pass characterId when a saved character or the studio narrator should speak.
- Pass media stills for drawn, slowly moving pictures at a fraction of the cost of filming. Pass media loop to read the words over a looping background, the cheapest option. Both need a voice.
- Pass verbatim true when they want their words read exactly as written. The length then follows the script.
- In a verbatim script, text in [brackets] is never read. With media stills, each line is one picture and a bracket note says what it shows. [pause 1s] holds a silence with stills and loop.
- A prompt that is only a link is read and turned into the script.

Don't use when:
- The words are lyrics for a music video. Use make_lyrics_video.
- A photo of a person should say the lines to camera. Use make_avatar_video.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | yes | The script to speak, or the article text to turn into narration. |
| format | yes | Frame. 9:16 for Reels, TikTok, and Shorts. 1:1 for feeds. 16:9 for YouTube. |
| length | yes | Length in seconds, from 2 to 90. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| model | no | Footage model id from list_models. Overrides the model the tier would pick. Check its clip lengths, reference-picture support, and price in list_models first. |
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
| showText | no | Whether on-screen text and titles are allowed. Defaults to yes. |
| template | no | Template slug from list_templates, for this same mode. Recorded on the video; it does not change other settings. |
| characterId | no | Character id from list_characters: off, studio, or a saved character that has a picture. |
| media | no | What illustrates it: video films every scene, stills draws and animates pictures, loop plays a background clip. Defaults to video. |
| verbatim | no | Read the prompt word for word instead of rewriting it to fit the length. |
| backgroundId | no | Built-in background for media loop (list_backgrounds). Defaults to aurora. |
| backgroundKey | no | Their own uploaded video to loop behind the words, instead of backgroundId. Media loop only. |
| sourceUrl | no | The page the script came from, kept as a record on the video. |

### make_shorts_video

**Shorts / TikToks.** Your character says your script to camera, in the look you pick. Add a background if you want one.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They want a Short, TikTok, or Reel where their character says a script to camera.
- Pass the script word for word as prompt. The character's voice speaks it as written.
- Pass characterId. It must be a saved character with a picture, not off or the studio narrator.
- Pass presetId for the look. Pass one picture key in referenceKeys only when they gave a background picture.

Don't use when:
- No character should appear on screen. Use make_voiceover_video.
- They gave a photo of someone who is not a saved character. Use make_avatar_video.
- They want several scenes or dialogue. Use start_production.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | yes | The script, word for word. The character says exactly this. |
| format | yes | Frame. 9:16 for Reels, TikTok, and Shorts. 1:1 for feeds. 16:9 for YouTube. |
| length | yes | Length in seconds, from 2 to 90. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| model | no | Footage model id from list_models. Overrides the model the tier would pick. Check its clip lengths, reference-picture support, and price in list_models first. |
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
| showText | no | Whether on-screen text and titles are allowed. Defaults to yes. |
| template | no | Template slug from list_templates, for this same mode. Recorded on the video; it does not change other settings. |
| characterId | no | Character id from list_characters: off, studio, or a saved character that has a picture. |
| referenceKeys | no | Optional. One picture key for the background. Leave it out to let the look decide the setting. |

Examples:

> Make a 20 second TikTok where Orel reads this script in a bright office.

```json
{"prompt":"Writing your Notes around you is costing you subscribers.","format":"9:16","length":20,"tier":"pro"}
```

### make_motion_graphics

**Motion Graphics Video.** Build a professional motion-graphics video from a brief.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They want charts, titles, or a designed motion-graphics piece rather than filmed footage.
- On the ultra tier, every number must come from a source they gave you. Do not invent figures.

Don't use when:
- They want a filmed scene. Use make_prompt_video.
- They want a character to narrate. This mode keeps its own audio. Leave the character off.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | yes | The idea. Name any figures that should appear. On ultra, include where each number came from. |
| format | yes | Frame. 9:16 for Reels, TikTok, and Shorts. 1:1 for feeds. 16:9 for YouTube. |
| length | yes | Length in seconds, from 2 to 90. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
| showText | no | Whether on-screen text and titles are allowed. Defaults to yes. |
| template | no | Template slug from list_templates, for this same mode. Recorded on the video; it does not change other settings. |

### make_music_video

**Music to Video.** Turn a song into a music video that follows the track.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They uploaded a song, or attached one in chat, and want visuals that follow the track.
- mediaKey is the audio upload. If you omit it, the attached audio file is used.

Don't use when:
- They only pasted lyrics and need a new song. Use compose_song, then make_lyrics_video.
- They want captions on a clip. Use add_captions.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | no | How the visuals should feel. Optional. The track drives the motion. |
| mediaKey | no | Audio upload key. Omit to use the attached audio file. |
| format | yes | Frame. 9:16 for Reels, TikTok, and Shorts. 1:1 for feeds. 16:9 for YouTube. |
| length | yes | Length in seconds, from 2 to 90. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| model | no | Footage model id from list_models. Overrides the model the tier would pick. Check its clip lengths, reference-picture support, and price in list_models first. |
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
| showText | no | Whether on-screen text and titles are allowed. Defaults to yes. |
| template | no | Template slug from list_templates, for this same mode. Recorded on the video; it does not change other settings. |

### make_avatar_video

**Talking Avatar.** Make a talking-avatar video from a photo and a script.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- A photo of a person should say a script to camera.
- mediaKey is that photo. If you omit it, the attached picture is used.

Don't use when:
- Nobody is on camera. Use make_voiceover_video.
- The photo should only guide a filmed scene. Use make_prompt_video with referenceKeys.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | yes | The words this person should say, looking at the camera. |
| mediaKey | no | Photo upload key. Omit to use the attached picture. |
| format | yes | Frame. 9:16 for Reels, TikTok, and Shorts. 1:1 for feeds. 16:9 for YouTube. |
| length | yes | Length in seconds, from 2 to 90. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| model | no | Footage model id from list_models. Overrides the model the tier would pick. Check its clip lengths, reference-picture support, and price in list_models first. |
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
| showText | no | Whether on-screen text and titles are allowed. Defaults to yes. |
| template | no | Template slug from list_templates, for this same mode. Recorded on the video; it does not change other settings. |

### make_image_video

**Image to Video.** Animate a still image into a short video clip.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They want a still animated into a short clip. The picture becomes the first frame.
- mediaKey is that still. A character can narrate. Pass characterId when they attached one.

Don't use when:
- They want a new picture first. Use generate_image, then pass its key here.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | yes | The motion. What moves, and how. |
| mediaKey | no | Still-image upload key. Omit to use the attached picture. |
| format | yes | Frame. 9:16 for Reels, TikTok, and Shorts. 1:1 for feeds. 16:9 for YouTube. |
| length | yes | Length in seconds, from 2 to 90. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| model | no | Footage model id from list_models. Overrides the model the tier would pick. Check its clip lengths, reference-picture support, and price in list_models first. |
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
| showText | no | Whether on-screen text and titles are allowed. Defaults to yes. |
| template | no | Template slug from list_templates, for this same mode. Recorded on the video; it does not change other settings. |
| characterId | no | Character id from list_characters: off, studio, or a saved character that has a picture. |

### make_av_cut

**Audio/Video to Video.** Find the most relevant clips from an audio or video file.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They uploaded audio or video and want the useful parts cut into a short clip.
- mediaKey is that file. If you omit it, the attached audio or video is used.

Don't use when:
- They want captions burned onto the whole video. Use add_captions.
- They want new footage. Use make_prompt_video.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | no | What the cut should keep. Optional. |
| mediaKey | no | Source audio or video upload key. Omit to use the attached file. |
| format | yes | Frame. 9:16 for Reels, TikTok, and Shorts. 1:1 for feeds. 16:9 for YouTube. |
| length | yes | Length in seconds, from 2 to 90. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| model | no | Footage model id from list_models. Overrides the model the tier would pick. Check its clip lengths, reference-picture support, and price in list_models first. |
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
| showText | no | Whether on-screen text and titles are allowed. Defaults to yes. |
| template | no | Template slug from list_templates, for this same mode. Recorded on the video; it does not change other settings. |

### make_lyrics_video

**Lyrics to Music Video.** Generate a lyrics video from pasted lyrics. Optional pictures can lock a singer or a look.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They pasted lyrics, or a song take already exists.
- The prompt is the lyric lines. Optional pictures lock a singer or a look. Copy attached picture keys into referenceKeys.
- On this mode the character voice performs the lyric lines. Pass characterId, and pass songId when compose_song or list_songs already made the take.
- Lyrics stay on screen. Do not turn this into a silent clip.
- When a brief lists frames:, pass those keys as referenceKeys in the same order.

Don't use when:
- They uploaded a finished song file. Use make_music_video.
- There is no song yet and they want one generated. Call compose_song first, then pass songId here.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | yes | The lyric lines this video performs. |
| format | yes | Frame. 9:16 for Reels, TikTok, and Shorts. 1:1 for feeds. 16:9 for YouTube. |
| length | yes | Length in seconds, from 2 to 90. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| model | no | Footage model id from list_models. Overrides the model the tier would pick. Check its clip lengths, reference-picture support, and price in list_models first. |
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
| showText | no | Whether on-screen text and titles are allowed. Defaults to yes. |
| template | no | Template slug from list_templates, for this same mode. Recorded on the video; it does not change other settings. |
| characterId | no | Character id from list_characters: off, studio, or a saved character that has a picture. |
| referenceKeys | no | Upload keys for reference pictures of a person or a look. Copy keys from an attached-pictures note. |
| songId | no | Song take id from compose_song or list_songs. Omit to compose during the video. |
| direction | no | Camera, pacing, and performance notes. |
| scene | no | Location, set, and wardrobe. |
| directionKeys | no | Upload keys of shot reference pictures for the direction. |
| sceneKeys | no | Upload keys of pictures of the location, set, or wardrobe. |
| cuts | no | Your own shot list, in order. Sets the number of shots and each one's length and camera, and skips the automatic planner. The seconds should add up to length. |

### add_captions

**Add Captions to Video.** Captions drawn into a video you upload, timed to the words as they are spoken.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They want captions on a video they uploaded.
- mediaKey is that video. If you omit it, the attached video is used.
- Keep captions to three to five words per line, in the middle third, high contrast.

Don't use when:
- There is no video file. Do not invent one.
- They want a new visual style. Captions do not take a visual preset.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | no | Optional notes. Leave empty to caption the upload as-is. |
| mediaKey | no | Video upload key. Omit to use the attached video. |
| format | yes | Frame. 9:16 for Reels, TikTok, and Shorts. 1:1 for feeds. 16:9 for YouTube. |
| length | yes | Length in seconds, from 2 to 90. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| template | no | Template slug from list_templates, for this same mode. Recorded on the video; it does not change other settings. |

### quick_edit_video

**Quick Edit.** Rotate, flip, resize, loop, or change the volume of a video you upload.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They want one plain change to a video they uploaded: rotate it, flip it, resize it, loop it, or change its volume.
- mediaKey is that video. If you omit it, the attached video is used.
- Pass op and value together. rotate: 90, 180, 270. flip: horizontal, vertical. resize: 9:16:crop, 9:16:pad, 1:1:crop, 1:1:pad, 16:9:crop, 16:9:pad. loop: 2 to 5. volume: 0 (mute), 50, 150, 200.

Don't use when:
- There is no video file. Do not invent one.
- They want captions. Use add_captions.
- They want to cut, reorder, or add layers. Open the editor instead.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| mediaKey | no | Video upload key. Omit to use the attached video. |
| op | yes | The change to make. |
| opValue | no | The setting for that change. Omit for its default. |
| template | no | Template slug from list_templates, for this same mode. Recorded on the video; it does not change other settings. |

Examples:

> This clip is sideways, fix it.

```json
{"op":"rotate","opValue":"90"}
```

### make_direct_video

**Direct Prompt.** Your prompt goes to the video model exactly as you typed it. Nothing is planned, rewritten, or added.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They wrote the exact prompt for the video model and want it sent untouched: no planning, no look, no voice, one clip.
- Pick the model with model (list_models). The length must be one that model films.

Don't use when:
- They described an idea and want it planned into shots. Use make_prompt_video.
- They want narration or a character voice. Use make_voiceover_video or make_prompt_video.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | yes | The whole prompt for the video model. Sent exactly as written. |
| format | yes | Frame. 9:16 for Reels, TikTok, and Shorts. 1:1 for feeds. 16:9 for YouTube. |
| length | yes | Length in seconds, from 2 to 90. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| model | no | Footage model id from list_models. Overrides the model the tier would pick. Check its clip lengths, reference-picture support, and price in list_models first. |
| template | no | Template slug from list_templates, for this same mode. Recorded on the video; it does not change other settings. |

Examples:

> Send this exact prompt to Kling 4: 'macro shot of rain on a leaf, 4k'

```json
{"prompt":"macro shot of rain on a leaf, 4k","format":"9:16","length":5,"model":"kling-4"}
```

### start_production

**Start this production.** Start a staged production for a multi-scene film. Starting the plan costs 1 credit. Filming spends credits when the preview is approved.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They asked for a multi-scene film, dialogue, or tighter control than a single Create video.
- Pass characterId when an attached character should speak every line and add its picture as a reference.
- Set voiceover to false when they want no spoken lines. Omit it so the plan keeps its voices.
- Pass hints to fix the scene count, scene lengths, music, sfx, ambience, narrator voice, transitions, or model.
- After planning, get_production shows every shot and sound; the production_* tools change them before approve_production.

Don't use when:
- A short first cut is enough. Use the matching make_* tool.
- They only want the Create form filled in. Use app_open_create.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| text | yes | The idea, outline, or script to produce. |
| format | no | Frame. Defaults to 9:16. |
| durationSec | no | Target length in seconds, from 5 to 180. Defaults to 30. |
| mode | no | review stops for the person. auto continues. Defaults to review. |
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
| characterId | no | Character id from list_characters: off, studio, or a saved character that has a picture. |
| voiceover | no | Set false when they want no spoken voiceover. Omit to keep the voices written into the plan. |
| creativeDelegation | no | True lets the planner make creative calls on its own instead of asking. Defaults to false. |
| budgetUsd | no | Spend cap in US dollars for filming, up to 500. Omit for no cap. |
| referenceKeys | no | Upload keys for reference pictures of a person or a look. Copy keys from an attached-pictures note. |
| hints | no | Hard planning constraints. Leave a field out to let the planner decide it. |

Examples:

> A three-scene story about a night bus.

```json
{"text":"Three scenes on a night bus, two people, one decision.","format":"9:16","durationSec":45,"mode":"review"}
```

## Plan

### make_storyboard

**Storyboard.** Generate one still per scene so they can see the video before it is filmed. Spends 1 credit a frame. Nothing is filmed.

Spends credits. Long-running. Needs approval at 30 credits or more.

Use when:
- A video request is detailed enough and they have not asked you to run wild. Call this before the brief.
- Pass the preset id from their Confirmed look line. If they named a preset, pass that id and skip the card.
- Pass one scene per beat, in order. A new video uses two to six scenes.
- On a revision that keeps the look, pass only the scenes whose frame should change, with the confirmed presetId.

Don't use when:
- They asked you to run wild or to just make it. Call the matching make_* tool.
- They want a picture that is not a scene of a video. Use generate_image.
- They have not confirmed the look. Stop after suggest_preset and wait for the card.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| format | no | Frame of every still. Defaults to 9:16. |
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| characterId | no | Character id from list_characters: off, studio, or a saved character that has a picture. |
| referenceKeys | no | Upload keys for reference pictures of a person or a look. Copy keys from an attached-pictures note. |
| scenes | yes | One still per scene, in order. One to six. A new video uses one frame per beat. |

Examples:

> Show me the scenes before you film the rooftop hero shot.

```json
{"format":"9:16","presetId":"auto","scenes":[{"seconds":5,"beat":"He turns toward the camera on the roof.","shotPrompt":"A man on a rooftop at golden hour, wind in his coat, city behind him"},{"seconds":5,"beat":"He leaps toward the skyline.","shotPrompt":"The same man leaps from the roof, low angle, glowing skyline"}]}
```

### plan_shots

**Plan shots.** Plan the cuts for a prompt or lyrics video and price them. Nothing is filmed or charged.

Long-running.

Use when:
- They want to see the shot list or the price before approving a prompt or lyrics video.
- You are about to write a brief and want the cut count to match the length.
- Pass the planned cuts (and brief and attachmentRoles for prompt) straight to make_prompt_video or make_lyrics_video, with the same model, so it films exactly this plan.

Don't use when:
- The mode is not prompt or lyrics. Those are the only modes with this planner.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | yes | The prompt or the lyric lines to plan. |
| length | yes | Length in seconds, from 2 to 90. |
| mode | no | Which planner. Defaults to lyrics. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| model | no | Footage model id from list_models. Overrides the model the tier would pick. Check its clip lengths, reference-picture support, and price in list_models first. |
| format | no | Frame. 9:16 for Reels, TikTok, and Shorts. 1:1 for feeds. 16:9 for YouTube. |
| direction | no | Camera and performance notes for lyrics. |
| scene | no | Location and wardrobe notes for lyrics. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| referenceCount | no | How many reference pictures. Omit to use the number attached in chat. |
| songReady | no | True when a song take already exists, so the price skips composing one. |

Examples:

> Plan a 30 second lyrics video before we film it.

```json
{"prompt":"First line\nSecond line","length":30,"mode":"lyrics","tier":"pro"}
```

### improve_narration

**Improve narration.** Rewrite a short description into one spoken narration paragraph. Does not spend credits.

Long-running.

Use when:
- They have a rough idea and the next step is a voiceover script.

Don't use when:
- They already have the script. Pass it to make_voiceover_video.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| description | yes | The rough idea to turn into spoken narration. |

### polish_look

**Polish a look.** Rewrite a loose style note into a render description. Does not spend credits or save it.

Long-running.

Use when:
- They described a look in casual words and you need a preset fragment before save_preset.

Don't use when:
- They want a catalog preset. Use suggest_preset.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| description | yes | The look, in their words. |

### save_preset

**Save a preset.** Save a visual preset on their account so later videos can use its id.

No side effects.

Use when:
- They asked to keep a look, and you have a name plus a render description.

Don't use when:
- The description is still casual. Call polish_look first.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| name | yes | Short name they will recognize. |
| promptFragment | yes | Render description: materials, light, camera, and mood. No studio names. |
| negativeFragment | no | What the look should avoid. |

### production_replan

**Re-plan a production.** Set planning hints (scene count, scene lengths, music, sfx, ambience, narrator, transitions, model) and plan the production again. No credits.

Long-running.

Use when:
- They want a different number of scenes, other scene lengths, no music, more sound effects, or a different model, before filming.
- The plan came back wrong and a few hard rules will fix it.

Don't use when:
- Changing one shot or one sound. Use production_update_shot or production_update_audio. Only before approval. Once filming starts, use production_refilm_shot or the edit_* tools on the finished cut.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| productionId | yes | Production id from list_my_productions or start_production. |
| hints | yes | Hard planning rules. Fields you leave out keep their earlier value. |

### production_update_shot

**Change a shot.** Rewrite one planned shot: action, framing, camera move, length, speech mode, or model. Free. Only before approval. Once filming starts, use production_refilm_shot or the edit_* tools on the finished cut.

No side effects.

Use when:
- They want a specific shot different: longer, a close-up, a slow push-in, another model.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| productionId | yes | Production id from list_my_productions or start_production. |
| shotId | yes | Shot id from get_production. |
| action | no | What happens in the shot. |
| purpose | no | Why the shot is there. |
| framing | no | e.g. wide, medium, close-up, over the shoulder. |
| cameraMotion | no | e.g. static, slow push-in, handheld, orbit. |
| emotionalArc | no | How the feeling changes across the shot. |
| intendedBeginning | no | The first frame. |
| intendedEnding | no | The last frame. |
| seconds | no | Length on screen. |
| speechMode | no | offscreen, native (the model voices it), or lipsync. |
| model | no | Model for this shot, or empty to use the production's. |

### production_remove_shot

**Remove a shot.** Drop a planned shot, and any sound that only played under it. Free. Only before approval. Once filming starts, use production_refilm_shot or the edit_* tools on the finished cut.

No side effects.

Use when:
- A shot isn't needed, or the film should be shorter.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| productionId | yes | Production id from list_my_productions or start_production. |
| shotId | yes | Shot id from get_production. |

### production_update_audio

**Change a sound.** Change a planned line, narration, music, ambience, or sound effect: words, voice, prompt, timing, fades, or which shots it plays under. Free. Only before approval. Once filming starts, use production_refilm_shot or the edit_* tools on the finished cut.

No side effects.

Use when:
- They want a line reworded, a different voice, calmer music, or an effect moved.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| productionId | yes | Production id from list_my_productions or start_production. |
| audioId | yes | Audio segment id from get_production. |
| text | no | Words, for dialogue and narration. |
| prompt | no | Sound description, for music, ambience, and sfx. |
| voiceId | no | Speech library voice id from list_voices. |
| seconds | no | How long it plays. |
| startOffsetSec | no | Start, from the beginning of its first shot. |
| fadeInSec | no | Fade in, in seconds. |
| fadeOutSec | no | Fade out, in seconds. |
| shotIds | no | Shots it plays under. |

### production_add_audio

**Add a sound.** Add a line, narration, music bed, ambience, or sound effect under chosen shots. Free. Only before approval. Once filming starts, use production_refilm_shot or the edit_* tools on the finished cut.

No side effects.

Use when:
- They want music added, a whoosh on a cut, rain ambience, or an extra narrated line.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| productionId | yes | Production id from list_my_productions or start_production. |
| track | yes | dialogue, narration, music, ambience, or sfx. |
| shotIds | yes | Shots it plays under, from get_production. |
| seconds | yes | How long it plays. |
| text | no | Words, required for dialogue and narration. |
| prompt | no | Sound description, required for music, ambience, and sfx. |
| voiceId | no | Speech library voice id, for dialogue and narration. |
| startOffsetSec | no | Start, from the beginning of its first shot. Defaults to 0. |
| fadeInSec | no | Fade in, in seconds. Music defaults to 0.5. |
| fadeOutSec | no | Fade out, in seconds. Music defaults to 1. |

### production_remove_audio

**Remove a sound.** Drop a planned line, music bed, ambience, or sound effect. Free. Only before approval. Once filming starts, use production_refilm_shot or the edit_* tools on the finished cut.

No side effects.

Use when:
- They want no music, or one effect or line gone.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| productionId | yes | Production id from list_my_productions or start_production. |
| audioId | yes | Audio segment id from get_production. |

## Assets

### generate_image

**Generate a picture.** Generate a picture and save it to their uploads. Spends 1 credit. The key can feed a video.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They need a still before make_image_video, make_avatar_video, or as a reference picture.
- Pass referenceKeys when an attached picture should guide the style.

Don't use when:
- They want an existing picture changed. Use edit_image.
- They want a character portrait with the portrait framing. Use create_character_portrait.
- A suggested look is still unconfirmed. Stop and wait for the card.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | yes | What the picture shows. |
| format | no | Frame of the still. Defaults to 1:1. |
| referenceKeys | no | Upload keys for reference pictures of a person or a look. Copy keys from an attached-pictures note. |

Examples:

> Make a portrait I can animate.

```json
{"prompt":"A woman in a red coat, soft window light","format":"9:16"}
```

### edit_image

**Edit a picture.** Change a picture they already uploaded and save the result. Spends 1 credit.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They want a fix: lighting, wardrobe, background, or a small change to a person who is already in the picture.
- sourceKey is the picture to edit. The edit is sent as a subject reference, which is the path the image model accepts.

Don't use when:
- They want a brand new picture. Use generate_image.
- They want the picture animated. Use make_image_video.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | yes | What to change. Say what must stay the same. |
| sourceKey | no | Upload key of the picture to edit. Omit to use the attached picture. |
| format | no | Frame of the result. Defaults to the source's closest frame, or 1:1. |

### compose_song

**Compose a song.** Compose one song take from lyrics. A character with a voice re-sings it. Spends credits.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- A lyrics video needs a song and list_songs has no take that fits.
- Pass the returned songId to make_lyrics_video.

Don't use when:
- They uploaded a finished track. Use make_music_video with that file.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | yes | Lyrics, plus any style note. The lyrics themselves are required. |
| style | no | Musical direction as a short comma list: genre, mood, tempo, instruments, vocal type. E.g. lo-fi hip hop, mellow, 80 bpm, female vocal. |
| length | yes | Length in seconds, from 2 to 90. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| characterId | no | Character id from list_characters: off, studio, or a saved character that has a picture. |

### create_character_portrait

**Character portrait.** Generate a front-facing portrait and save it. Spends 1 credit. Use the key in create_character.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They are making a character and do not already have a picture.

Don't use when:
- They already uploaded a photo. Pass that key to create_character.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| description | yes | Who this person is, in a few words. |

### design_voice

**Design a voice.** Design voice previews from a description. Spends 1 credit. Returns ids, not the audio.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They want a new voice for a character.
- Pass one returned generatedVoiceId to create_character with voiceMode designed.

Don't use when:
- They want the studio narrator or a character that already has a voice. Use list_characters.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| description | yes | How the voice should sound. |

### create_character

**Create a character.** Save a character from a picture and an optional designed voice. Does not spend credits.

Long-running.

Use when:
- They asked to keep a person for later videos.
- imageKey is a portrait you generated or a picture they uploaded. voiceMode none skips the voice. designed uses a generatedVoiceId from design_voice.

Don't use when:
- They want to record a voice in the browser. Send them to the Characters page. This tool cannot take a recording.
- The character already exists. Use list_characters and pass that id.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| name | yes | Name they will recognize. |
| imageKey | yes | Upload key of the character's picture. |
| imagePrompt | no | The prompt that made the picture, if you have it. |
| voiceMode | no | none keeps them silent. designed needs generatedVoiceId. Defaults to none. |
| generatedVoiceId | no | Id from design_voice. Required when voiceMode is designed. |
| voiceDescription | no | The voice description you passed to design_voice. Required when voiceMode is designed. |

### import_media_from_url

**Import media from a link.** Download a public picture, song, or clip into the person's uploads and get its key.

No side effects.

Use when:
- You have a file as a public https link and a tool needs an upload key (mediaKey, referenceKeys, backgroundKey, edit_add_media).
- Over MCP this is how you attach your own media: there is no chat composer.

Don't use when:
- The file is already uploaded. Use list_uploads to find its key.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| url | yes | Public http(s) link straight to the file. |

## Library

### list_modes

**List video modes.** Every Create mode, the make_* tool that queues it, what it needs, and which model each tier films with.

Read only.

Use when:
- Before choosing how to make a video, or when they ask what kinds of videos PoliVid makes.
- To see which tier maps to which footage model and resolution.

Inputs:
- None.

### list_models

**List footage models.** Footage models you can pass as model: clip lengths, resolutions, native audio, reference pictures, and price.

Read only.

Use when:
- Before passing model to a make_* tool or estimate_credits.
- They ask which model is best, cheapest, longest, or has sound.

Don't use when:
- Motion graphics, captions, and quick edits film nothing and take no model.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| mode | no | Only models that suit this mode, e.g. those that take reference pictures for lyrics. |

### list_templates

**List templates.** Ready-made Create templates (product ad, explainer, top list…) with their mode and default settings.

Read only.

Use when:
- They name a kind of video (an ad, a listicle, a quote card) and you want a starting point.
- Pass the slug as template on that mode's make_* tool, and copy its defaults into the call.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| query | no | Search words matched against name, description, and keywords. |
| mode | no | Only templates for this mode. |

### list_voices

**List voices.** Voices that can speak: the studio narrator, saved characters with a voice, and the speech library used by productions.

Read only.

Use when:
- Before passing characterId for narration, or a voiceId to a production.
- They ask what voices are available.

Don't use when:
- They want a new voice. Use design_voice or create_character.

Inputs:
- None.

### list_backgrounds

**List backgrounds.** Built-in looping backgrounds for a voiceover read over a loop (media loop).

Read only.

Use when:
- Before passing backgroundId to make_voiceover_video with media loop.

Inputs:
- None.

### list_options

**List options.** Every fixed choice in one call: formats, length limits, tiers, visual media, quick-edit ops and values, attachment roles, caption and edit limits.

Read only.

Use when:
- You need the allowed values for a field and the tool description doesn't list them.

Inputs:
- None.

### list_characters

**List characters.** List saved characters plus studio and off.

Read only.

Use when:
- You need a characterId for a video, a production, a song, or a new character's voice.
- The person asks who they can put on screen or which voices they have.

Don't use when:
- You already have the character id from an attached-character note. Use that id.

Inputs:
- None.

Examples:

> Who can narrate this?

```json
{}
```

### list_presets

**List presets.** List visual presets the person can apply to a video.

Read only.

Use when:
- You need a real preset id before making a video or saving a look.
- The person asks what styles exist, including looks they saved.

Don't use when:
- You only need one recommendation. Use suggest_preset.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| engine | no | Which preset list. footage for filmed clips, motion for motion graphics, both for everything. Defaults to footage. |

Examples:

> What looks can I use?

```json
{"engine":"footage"}
```

### suggest_preset

**Suggest a preset.** Recommend one visual preset from a short brief.

Long-running.

Use when:
- The person described a look and you should pick one preset instead of listing them all.
- Then stop. The person confirms or switches the look on the card. Do not generate pictures in that turn.

Don't use when:
- They already named a preset, or the video is captions. Captions ignore presets.
- They asked you to run wild or to just make it. Pass a preset id on the make_* tool.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| brief | yes | What the video should look and feel like. |
| engine | no | footage for filmed clips, motion for motion graphics. Defaults to footage. |

Examples:

> Make it feel like a Pixar short.

```json
{"brief":"Warm 3D animated short","engine":"footage"}
```

### list_my_videos

**List videos.** List the person's generated videos and active jobs.

Read only.

Use when:
- They ask what they have made, or you need a video id before opening, retrying, or editing one.

Inputs:
- None.

Examples:

> What videos do I have?

```json
{}
```

### get_video

**Read a video.** Read one of the person's videos.

Read only.

Use when:
- You have a video id and need its prompt, status, format, or error before acting on it.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| videoId | yes | Id from list_my_videos or from a link the person pasted. |

### list_my_productions

**List productions.** List staged productions.

Read only.

Use when:
- They ask about a multi-scene film, or you need a production id.

Don't use when:
- They mean a short Create video. Use list_my_videos.

Inputs:
- None.

### get_production

**Read a production.** Read one staged production: status, scenes, every shot and sound segment with ids and seconds, planning hints, steps, and versions.

Read only.

Use when:
- You have a production id and need its stage, status, or error before answering or approving it.
- Before editing the plan or refilming a shot, to get shot and audio ids.
- To find a stepId for retry_production or a versionId for restore_version.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| productionId | yes | Id from list_my_productions. |

### list_uploads

**List uploads.** List pictures, audio, and video the person has uploaded.

Read only.

Use when:
- A make tool needs a file and they did not attach one in this chat.
- They say to use a photo, song, or clip they uploaded earlier.

Don't use when:
- They attached the file in this chat. Use that key.

Inputs:
- None.

Examples:

> Use the song I uploaded yesterday.

```json
{}
```

### list_songs

**List songs.** List song takes already composed for this person.

Read only.

Use when:
- A lyrics video should reuse a song instead of composing a new one. Pass the id as songId.

Don't use when:
- No take fits the lyrics. Use compose_song.

Inputs:
- None.

## Jobs

### production_refilm_shot

**Refilm a shot.** Film one shot of a production again, optionally with another model, then rebuild the film. Spends credits for that shot only.

Spends credits. Long-running. Needs approval at 1 credits or more.

Use when:
- Filming started or finished and one shot came out wrong.
- They want a single shot redone with a better model.

Don't use when:
- Nothing is filmed yet. Change the plan with production_update_shot instead.
- They want the whole film again. Use regenerate_production.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| productionId | yes | Production id from list_my_productions or start_production. |
| shotId | yes | Shot id from get_production. |
| model | no | Footage model id. Only models list_models marks production: true can film production shots. |

### retry_video

**Retry a video.** Continue a failed video from the clips already stored. Holds credits again.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- get_video says the video failed and at least one clip was saved.

Don't use when:
- Nothing was saved. They need a new make_* call.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| videoId | yes | Video or job id from list_my_videos. |

### pause_video

**Pause a video.** Finish the clip already filming, then stop and wait. Does not spend credits.

Long-running.

Use when:
- A video is filming and they want it to stop after the current clip.

Don't use when:
- The video is a single clip. Pausing is not available.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| videoId | yes | Video or job id from list_my_videos. |

### resume_video

**Resume a video.** Continue a paused video at the next clip. Does not take a new credit hold.

Long-running.

Use when:
- They paused a video and want filming to continue.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| videoId | yes | Video or job id from list_my_videos. |

### cancel_video

**Cancel a video.** Cancel a queued, running, or paused video.

Destructive. Needs approval.

Use when:
- They want a video job stopped and discarded.

Don't use when:
- They only want a pause. Use pause_video.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| videoId | yes | Video or job id from list_my_videos. |

### answer_production_questions

**Answer production questions.** Send answers and resume planning a staged production. Does not spend credits.

Long-running.

Use when:
- get_production shows the production is waiting on questions, and the person has answered them.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| productionId | yes | Production id from list_my_productions. |
| answers | yes | Question id to the person's answer. |

### approve_production

**Approve a production.** Approve a production that is waiting in preview and start generation. Spends credits.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- get_production says status is preview and they want it filmed.

Don't use when:
- It is not in preview. Read it first.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| productionId | yes | Production id from list_my_productions. |

### regenerate_production

**Regenerate a production.** Start a new generation from a production that is ready. Spends credits.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- A ready production should be generated again.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| productionId | yes | Production id from list_my_productions. |

### retry_production

**Retry a production.** Retry one failed step, or resume from the last step. Does not take a new credit hold here.

Long-running.

Use when:
- A production failed mid-way and they want it to continue.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| productionId | yes | Production id from list_my_productions. |
| stepId | no | Step to retry. Omit to resume from the last step. |

### cancel_production

**Cancel a production.** Cancel the open steps of a production.

Destructive. Needs approval.

Use when:
- They want a staged production stopped.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| productionId | yes | Production id from list_my_productions. |

### restore_version

**Restore a version.** Point a production entity back at an earlier version.

Destructive. Needs approval.

Use when:
- They named a version id and want that version to be current again.

Don't use when:
- You do not have a version id. Do not guess one.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| productionId | yes | Production id from list_my_productions. |
| versionId | yes | Entity version id to make current. |

### continue_video_with_model

**Continue with another model.** Restart a video that stopped waiting for a different footage model, using the model you name. Uses the credits already held for it.

Long-running.

Use when:
- get_video shows the video waiting for a model, often because the first one refused the prompt or the shape.
- Pick one from list_models that films this format and is not the one that failed.

Don't use when:
- The video failed for another reason. Use retry_video.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| videoId | yes | Video or job id from list_my_videos. |
| model | yes | Footage model id from list_models. |

## Editor

### open_in_editor

**Open in the editor.** Open a ready video or a finished production as an editor project. Does not spend credits.

No side effects.

Use when:
- They want to trim, rearrange, or title a video that is already ready.
- Pass videoId or productionId, not both. Then call app_open_editor with the returned projectId.

Don't use when:
- The video is still filming. Wait, or use pause_video.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| videoId | no | Ready video to open. |
| productionId | no | Production whose timeline should open. |
| format | no | Frame for a blank project. Ignored when a video or production is set. |

### export_edit

**Export an edit.** Render an editor project to a video. Spends credits.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They finished an edit and want the video file.

Don't use when:
- There is no editor project yet. Call open_in_editor first.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | yes | Editor project id from open_in_editor. |

### edit_read_timeline

**Read the timeline.** List the tracks and clips in the open project, with ids and times in seconds. The sound field says whether a Voiceover clip was added after filming.

Read only.

Use when:
- Before any edit, so you use real clip ids.
- When they ask what is on the timeline, or where a voice is coming from.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| detail | no | True adds every clip property (transform, opacity, text style, transitions, fades, trim) and the media list. |

### edit_add_text

**Add text.** Add a title or caption on the text track. Free.

No side effects.

Use when:
- They want words on screen, such as a title at the start.

Don't use when:
- They want spoken captions for the whole video. Use edit_add_captions.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| text | yes | The words on screen. |
| startSec | no | When the words appear, in seconds. Defaults to 0. |
| endSec | no | When the words leave, in seconds. Defaults to 3 seconds later. |
| position | no | Where the words sit: top, center, or bottom. |

### edit_update_text

**Update text.** Change the words or the position of a text clip. Free.

No side effects.

Use when:
- A title is already on the timeline and they want different words or placement.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| itemId | yes | Text clip id from edit_read_timeline. |
| text | no | Replacement words. |
| position | no | Where the words sit: top, center, or bottom. |

### edit_trim

**Trim a clip.** Move a clip's start or end. Free. The finished video is one clip. Split it, then remove the piece you do not want.

No side effects.

Use when:
- They want the video shorter, or a title to end sooner.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| itemId | yes | Clip id from edit_read_timeline. |
| startSec | no | New start, in seconds. |
| endSec | no | New end, in seconds. |

### edit_split

**Split a clip.** Cut one clip into two at a time. Free. The finished video is one clip. Split it, then remove the piece you do not want.

No side effects.

Use when:
- They want to drop or move part of the video, not the whole clip.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| itemId | yes | Clip id from edit_read_timeline. |
| atSec | yes | Where to cut, in seconds, inside the clip. |

### edit_remove

**Remove a clip.** Delete a clip. Free. The finished video is one clip. Split it, then remove the piece you do not want.

No side effects.

Use when:
- They want a title, a song, a Voiceover clip, or a split piece gone.
- They want a voice that was added after filming taken off. Remove the Voiceover clip. That is free.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| itemId | yes | Clip id from edit_read_timeline. |
| ripple | no | When true, later clips on that track slide left to close the gap. |

### edit_move

**Move a clip.** Slide a clip to a new start time, or onto another track of the same kind. Free.

No side effects.

Use when:
- They want a title or song to start later or earlier.
- They want a clip on a different layer. Pass trackId.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| itemId | yes | Clip id from edit_read_timeline. |
| startSec | no | New start, in seconds. Omit to keep the start when only changing track. |
| trackId | no | Track to move it onto. Must be the same kind (visual, text, audio). |

### edit_add_music

**Add music.** Lay a song, a sound effect, or an attached audio file on the audio track. Free.

No side effects.

Use when:
- They want music under the cut. Use a song id, an upload key, or the attached audio.
- They want a sound effect at a moment. Pass role sfx, startSec, and the upload key; sfx defaults to full volume and no fades.

Don't use when:
- They want a new music video from scratch. Use make_music_video.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| songId | no | Song id from list_songs or compose_song. |
| mediaKey | no | Upload key for an audio file. Omit to use the attached audio. |
| startSec | no | When the song starts, in seconds. Defaults to 0. |
| volume | no | Loudness from 0 to 2. Defaults to 0.35. |
| fadeInSec | no | Fade in, in seconds. |
| fadeOutSec | no | Fade out, in seconds. |
| seconds | no | Length when the file's length is unknown. |
| role | no | music (default) or sfx. |
| durationSec | no | Play only this many seconds of it. |

### edit_set_volume

**Set volume.** Change a clip's volume, or mute a track. Free. Turn down the Voiceover clip, or set an older mixed video clip to 0.

No side effects.

Use when:
- The song or the Voiceover clip is too loud, or they want a track silent.
- sound.kind is mixed. Set sound.videoItemId to volume 0. That silences the whole older clip.

Don't use when:
- They want the voice gone and a Voiceover clip is on the Audio track. Use edit_remove. Do not start a new video.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| itemId | no | Audio or video clip id. |
| trackId | no | Track id to mute or unmute. |
| volume | no | Loudness from 0 to 2. |
| muted | no | With trackId: true mutes, false unmutes. Defaults to true. |

### edit_add_captions

**Add captions.** Put the spoken words on screen as timed text. Uses the video's script, or a transcript. Free.

Long-running.

Use when:
- They want captions on the open project.

Don't use when:
- There is no project yet. add_captions makes a new captioned video and spends credits.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |

### edit_set_project

**Rename or reshape.** Rename the project or change its frame (9:16, 1:1, 16:9). Free.

No side effects.

Use when:
- They want a different title or aspect ratio for the edit.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| title | no | New project title. |
| format | no | New frame. Clips keep their framing; check with edit_read_timeline. |

### edit_add_track

**Add a track.** Add a visual, text, or audio track (a layer). Free.

No side effects.

Use when:
- They want another layer: a picture-in-picture, a second title row, or music and sound effects on separate lanes.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| kind | yes | visual for video and pictures, text for titles, audio for sound. |
| name | no | Track name. |
| index | no | Position in the track list, 0 first. Omit to add at the end. |

### edit_update_track

**Update a track.** Rename a track, or mute, hide, lock, or unlock it. Free.

No side effects.

Use when:
- They want a layer silent, invisible, or protected from changes.
- An edit failed with "This track is locked." Unlock it first, if they agree.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| trackId | yes | Track id from edit_read_timeline. |
| name | no | New name. |
| muted | no | Silence an audio track. |
| hidden | no | Hide a visual or text track. |
| locked | no | Lock or unlock the track. |

### edit_remove_track

**Remove a track.** Delete a track and every clip on it. Free; edit_undo brings it back.

No side effects.

Use when:
- They want a whole layer gone.

Don't use when:
- They want one clip gone. Use edit_remove.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| trackId | yes | Track id from edit_read_timeline. |

### edit_reorder_track

**Reorder a track.** Move a track up or down the list. Later visual tracks draw on top. Free.

No side effects.

Use when:
- A layer should sit above or below another.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| trackId | yes | Track id from edit_read_timeline. |
| index | yes | New position, 0 first. |

### edit_duplicate

**Duplicate a clip.** Copy a clip. The copy goes right after the original unless you say where. Free.

No side effects.

Use when:
- They want a clip, title, or sound repeated.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| itemId | yes | Clip id from edit_read_timeline. |
| startSec | no | Where the copy starts. |
| trackId | no | Track for the copy, same kind. |

### edit_crossfade

**Crossfade two clips.** Overlap two clips on the same track with a fade between them. Free.

No side effects.

Use when:
- They want a smooth blend from one clip into the next.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| firstId | yes | The earlier clip. |
| secondId | yes | The later clip. |
| seconds | no | Overlap length. Defaults to 0.4. |

### edit_set_transition

**Set a transition.** Set how a clip enters or leaves: fade, slide, wipe, zoom, or none. Free.

No side effects.

Use when:
- They want a clip, picture, scene, or title to fade, slide, wipe, or zoom in or out.

Don't use when:
- It is an audio clip. Use edit_set_audio fades.
- Two clips should blend into each other. Use edit_crossfade.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| itemId | yes | Clip id from edit_read_timeline. |
| type | yes | fade, slide, wipe, zoom, or none to remove it. |
| edge | no | Which end. Defaults to both. |
| seconds | no | Length. Defaults to 0.4. |

### edit_set_transform

**Position and size.** Move, scale, rotate, fit, or fade a video, picture, or text clip on the frame. Free.

No side effects.

Use when:
- They want a picture-in-picture, a zoomed crop, a tilt, or a semi-transparent overlay.
- fillFrame true resets to centred, full size, unrotated.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| itemId | yes | Clip id from edit_read_timeline. |
| x | no | Horizontal offset, percent of the frame width. 0 is centred. |
| y | no | Vertical offset, percent of the frame height. 0 is centred, negative is up. |
| scale | no | Size. 1 fills the frame; 0.4 is a small inset. Video never shrinks below 1. |
| rotation | no | Degrees clockwise. |
| fit | no | cover crops to fill, contain shows the whole picture. |
| opacity | no | 0 invisible to 1 solid. Not for text. |
| fillFrame | no | Reset position, size, and rotation first. |

### edit_style_text

**Style text.** Change the font, size, weight, color, box, alignment, position, and in/out animation of one or more text clips. Free.

No side effects.

Use when:
- They want titles bigger, bolder, a different color or font, without a box, or animated differently.

Don't use when:
- They want every caption restyled. Use edit_style_captions.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| itemIds | yes | Text clip ids from edit_read_timeline. |
| fontFamily | no | CSS font family, e.g. Inter, Georgia, Impact. |
| fontSize | no | Size in pixels on the full-size frame. Titles 60-110, captions 36-48. |
| fontWeight | no | 100 thin to 900 black. 700 is bold. |
| color | no | Text color, e.g. #FFFFFF or rgb(255,200,0). |
| background | no | Box behind the words, e.g. rgba(0,0,0,0.55). null removes the box. |
| align | no | left, center, or right. |
| position | no | Where the words sit: top, center, or bottom. |
| animationIn | no | How the words appear. |
| animationOut | no | How the words leave. |

### edit_style_captions

**Style captions.** Restyle every caption at once: font, size, color, box, position, animation. Free.

No side effects.

Use when:
- They want the captions bigger, higher, yellow, without a box, and so on.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| fontFamily | no | CSS font family, e.g. Inter, Georgia, Impact. |
| fontSize | no | Size in pixels on the full-size frame. Titles 60-110, captions 36-48. |
| fontWeight | no | 100 thin to 900 black. 700 is bold. |
| color | no | Text color, e.g. #FFFFFF or rgb(255,200,0). |
| background | no | Box behind the words, e.g. rgba(0,0,0,0.55). null removes the box. |
| align | no | left, center, or right. |
| position | no | Where the words sit: top, center, or bottom. |
| animationIn | no | How the words appear. |
| animationOut | no | How the words leave. |

### edit_remove_captions

**Remove captions.** Delete every caption, keeping other titles. Free; edit_undo brings them back.

No side effects.

Use when:
- They want the captions gone, or want to add them again with a different style.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |

### edit_set_audio

**Set sound.** Change a clip's volume, an audio clip's fade in and out, or mark it as music, sfx, or voice. Free.

No side effects.

Use when:
- The music should fade out at the end, a sound effect is too quiet, or the voice should duck.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| itemId | yes | Audio or video clip id from edit_read_timeline. |
| volume | no | 0 silent, 1 as recorded, 2 double. |
| fadeInSec | no | Audio clips only. |
| fadeOutSec | no | Audio clips only. |
| role | no | music, sfx, or voice. Audio clips only. |

### edit_set_image_motion

**Camera move on a picture.** Give a still picture a slow zoom or pan, or stop it. Free.

No side effects.

Use when:
- A picture clip should feel alive: Ken Burns zoom in, pan left, and so on.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| itemId | yes | Picture clip id from edit_read_timeline. |
| motion | yes | The move, or none. |
| amount | no | How far it travels, as a share of the frame. Defaults to 0.12. |

### edit_add_media

**Add a picture, clip, or sound.** Put an uploaded picture, video, or audio file, or one of their finished videos, on the timeline. Free.

No side effects.

Use when:
- They want a B-roll clip, a logo, a picture, or a sound placed at a time.
- Get a key with list_uploads or import_media_from_url, or a videoId from list_my_videos.

Don't use when:
- It is a song or background music. edit_add_music sets music defaults.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| mediaKey | no | Upload key of a picture, video, or audio file. |
| videoId | no | A finished video from list_my_videos, placed as a clip. |
| startSec | no | Where it starts. Defaults to 0. |
| durationSec | no | How long it shows. Pictures default to 3 s; clips and sounds to their length. |
| trackId | no | Track to put it on. Defaults to the first unlocked track of the right kind. |
| role | no | For audio: music, sfx, or voice. |

### edit_batch

**Several edits at once.** Apply a list of edits in order as one change, so they land together and undo together. Free.

No side effects.

Use when:
- You have several edits planned, e.g. trim three clips and restyle the titles.
- Each op names an edit tool and its arguments, without projectId.

Don't use when:
- The edits need media lookups (music, media, captions). Call those tools on their own.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| ops | yes | Edits to apply, in order. If any fails, none are saved. |

### edit_undo

**Undo the last edit.** Put the timeline back to how it was before the last agent edit. Free.

No side effects.

Use when:
- They don't like the last change, or an edit went wrong.

Don't use when:
- They want an older version. Use edit_list_revisions and edit_restore_revision.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |

### edit_list_revisions

**List edit history.** List saved versions of the timeline, newest first, with what changed. Free.

Read only.

Use when:
- They want to go back further than one undo, or see what changed.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |

### edit_restore_revision

**Restore a version.** Put back a saved version from edit_list_revisions. The current timeline is kept as a version too. Free.

No side effects.

Use when:
- They want the edit as it was at an earlier point.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| revisionId | yes | Revision id from edit_list_revisions. |

### edit_revert_to_original

**Revert to the original.** Throw away every edit and rebuild the timeline from the source video. edit_undo can still bring the edits back.

Destructive. Needs approval.

Use when:
- They want to start the edit over from the generated video.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |

## Account

### get_credit_balance

**Credit balance.** Read remaining credits.

Read only.

Use when:
- The person asks what they can afford, or you are about to propose a video that spends credits.

Inputs:
- None.

### estimate_credits

**Estimate credits.** Estimate credits for a Create video or an existing staged production.

Read only.

Use when:
- You are writing a brief and want a price before they approve.
- They ask what a production will cost. Pass its productionId.
- To compare models or media, call it once per option. It is free.

Don't use when:
- You are only checking the balance. Use get_credit_balance.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| tool | no | Name of any tool that spends credits, e.g. make_prompt_video. Pass its arguments in arguments to get the exact price that call would hold. |
| arguments | no | The arguments you would send to that tool. |
| mode | no | Create mode to price. Ignored when tool or productionId is set. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| model | no | Footage model id from list_models. Overrides the model the tier would pick. Check its clip lengths, reference-picture support, and price in list_models first. |
| media | no | video, stills, or loop. Stills and loop are much cheaper than filming. |
| length | no | Seconds to price for a Create video. Required unless tool or productionId is set. |
| cuts | no | Your own shot list, in order. Sets the number of shots and each one's length and camera, and skips the automatic planner. The seconds should add up to length. |
| productionId | no | Existing production to price. |

Examples:

> How many credits is a 30 second pro reel?

```json
{"mode":"prompt","tier":"pro","length":30}
```

## Navigate

### app_open_create

**Open Create.** Open the Create form with these settings filled in. Does not spend credits.

Runs in the app.

Use when:
- They want to tweak the form themselves instead of generating now.
- Pass mode so the right Create page opens: prompt, voiceover, motion-graphics, music, avatar, image, av-to-video, lyrics, or captions.
- Pass referenceKeys so attached pictures are waiting. Pass mediaKey so an attached song or clip is waiting.

Don't use when:
- They already approved a brief. Call the matching make tool instead.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | yes | Text to put in the prompt box. May be empty when the mode allows it. |
| mode | no | Create mode page to open. Defaults to the prompt page. |
| format | no | Frame. 9:16 for Reels, TikTok, and Shorts. 1:1 for feeds. 16:9 for YouTube. |
| length | no | Length in seconds, from 2 to 90. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
| characterId | no | Character id from list_characters: off, studio, or a saved character that has a picture. |
| referenceKeys | no | Upload keys for reference pictures of a person or a look. Copy keys from an attached-pictures note. |
| mediaKey | no | Upload key for a song, photo, or source clip that the mode requires. |

Examples:

> Put this on the form, I'll press generate.

```json
{"prompt":"A cat on a roof at dusk","mode":"prompt","format":"9:16","length":15}
```

### app_open_video

**Open a video.** Open one of the person's videos.

Runs in the app.

Use when:
- They want to watch a video you just queued or one they already have.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| videoId | yes | Video id from list_my_videos or from a make tool result. |

### app_open_production

**Open a production.** Open one of the person's productions.

Runs in the app.

Use when:
- They should review a staged production, answer its questions, or watch its progress.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| productionId | yes | Production id from list_my_productions or start_production. |

### app_open_editor

**Open the editor.** Open an editor project.

Runs in the app.

Use when:
- open_in_editor just returned a projectId and they should land on the timeline.

Don't use when:
- You have not created the project yet. Call open_in_editor first.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | yes | Editor project id from open_in_editor. |

## Ask

### app_confirm_preset

**Confirm a look.** Ask the person to confirm a visual preset, or pick a different one, before any picture is generated.

Read only. Waits for the person.

Use when:
- You just called suggest_preset. Pass its preset id, reason, and engine, then stop.
- The result is presetId. Pass that exact id to make_storyboard. Do not generate pictures before it returns.

Don't use when:
- They already named a preset. Use that id.
- They already confirmed this look.
- They asked you to run wild or to just make it.
- The video is captions. Captions ignore presets.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| presetId | yes | Preset id from suggest_preset. They can switch it before confirming. |
| reason | no | Why you suggested it, from suggest_preset. |
| engine | no | footage or motion, matching suggest_preset. Defaults to footage. |

Examples:

> Use a cinematic look, and let me switch it before the pictures.

```json
{"presetId":"movie","reason":"Anamorphic drama fits the chase.","engine":"footage"}
```

### app_ask_question

**Ask a question.** Ask the person a structured question in the chat.

Read only. Waits for the person.

Use when:
- A choice is a short list, such as format, length, which story, or which character.
- You need at most one or two answers before a storyboard or a brief.

Don't use when:
- You can assume a sensible default and mention it.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| question | yes | The question, in the person's language. |
| options | no | Up to six choices. Omit for a free-text answer. |

Examples:

> Vertical or horizontal?

```json
{"question":"Which frame?","options":["9:16","16:9","1:1"]}
```
