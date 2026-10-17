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
- A character narrates when the mode is prompt and the character has a voice. Pass characterId.
- Write one action per beat. Create films this as 5–7 second clips that continue from the previous last frame.

Don't use when:
- They pasted a script to be spoken. Use make_voiceover_video.
- They pasted lyrics. Use make_lyrics_video.
- They want a multi-scene film with dialogue control. Use start_production.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | yes | What to film. Subject, one action, setting, camera, light, and mood. |
| format | yes | Frame. 9:16 for Reels, TikTok, and Shorts. 1:1 for feeds. 16:9 for YouTube. |
| length | yes | Length in seconds, from 2 to 90. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
| showText | no | Whether on-screen text is allowed. Defaults to yes. |
| characterId | no | Character id from list_characters: off, studio, or a saved character that has a picture. |
| referenceKeys | no | Upload keys for reference pictures of a person or a look. Copy keys from an attached-pictures note. |

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
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
| characterId | no | Character id from list_characters: off, studio, or a saved character that has a picture. |

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
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |

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
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
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
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |

### make_lyrics_video

**Lyrics to Music Video.** Generate a lyrics video from pasted lyrics. Optional pictures can lock a singer or a look.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They pasted lyrics, or a song take already exists.
- The prompt is the lyric lines. Optional pictures lock a singer or a look. Copy attached picture keys into referenceKeys.
- On this mode the character voice performs the lyric lines. Pass characterId, and pass songId when compose_song or list_songs already made the take.
- Lyrics stay on screen. Do not turn this into a silent clip.

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
| presetId | no | Visual preset id from list_presets or suggest_preset. auto lets the model pick. |
| visualDirection | no | Look and shot notes, at most 600 characters. |
| characterId | no | Character id from list_characters: off, studio, or a saved character that has a picture. |
| referenceKeys | no | Upload keys for reference pictures of a person or a look. Copy keys from an attached-pictures note. |
| songId | no | Song take id from compose_song or list_songs. Omit to compose during the video. |
| direction | no | Camera, pacing, and performance notes. |
| scene | no | Location, set, and wardrobe. |

### add_captions

**Add Captions to Video.** Add AI-generated captions to an uploaded video.

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

### start_production

**Start this production.** Start a staged production for a multi-scene film. Starting the plan costs 1 credit. Filming spends credits when the preview is approved.

Spends credits. Long-running. Needs approval at 200 credits or more.

Use when:
- They asked for a multi-scene film, dialogue, or tighter control than a single Create video.
- Pass characterId when an attached character should speak every line and add its picture as a reference.

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

Examples:

> A three-scene story about a night bus.

```json
{"text":"Three scenes on a night bus, two people, one decision.","format":"9:16","durationSec":45,"mode":"review"}
```

## Plan

### plan_shots

**Plan shots.** Plan the cuts for a prompt or lyrics video and price them. Nothing is filmed or charged.

Long-running.

Use when:
- They want to see the shot list or the price before approving a prompt or lyrics video.
- You are about to write a brief and want the cut count to match the length.

Don't use when:
- The mode is not prompt or lyrics. Those are the only modes with this planner.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| prompt | yes | The prompt or the lyric lines to plan. |
| length | yes | Length in seconds, from 2 to 90. |
| mode | no | Which planner. Defaults to lyrics. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
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

## Library

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

Don't use when:
- They already named a preset, or the video is captions. Captions ignore presets.

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

**Read a production.** Read one staged production.

Read only.

Use when:
- You have a production id and need its stage, status, or error before answering or approving it.

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

**Read the timeline.** List the tracks and clips in the open project, with ids and times in seconds.

Read only.

Use when:
- Before any edit, so you use real clip ids.
- When they ask what is on the timeline.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |

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
- They want a title, a song, or a split piece gone.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| itemId | yes | Clip id from edit_read_timeline. |
| ripple | no | When true, later clips on that track slide left to close the gap. |

### edit_move

**Move a clip.** Slide a clip to a new start time. Free.

No side effects.

Use when:
- They want a title or song to start later or earlier.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| itemId | yes | Clip id from edit_read_timeline. |
| startSec | yes | New start, in seconds. |

### edit_add_music

**Add music.** Lay a song or an attached audio file under the video. Free.

No side effects.

Use when:
- They want music under the cut. Use a song id, an upload key, or the attached audio.

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

### edit_set_volume

**Set volume.** Change a clip's volume, or mute a track. Free.

No side effects.

Use when:
- The song is too loud, or they want a track silent.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| projectId | no | Editor project id. Omit it in this chat; the open project is used. |
| itemId | no | Audio or video clip id. |
| trackId | no | Track id to mute or unmute. |
| volume | no | Loudness from 0 to 2. |
| muted | no | Mute the track when true. |

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

Don't use when:
- You are only checking the balance. Use get_credit_balance.

Inputs:

| Field | Required | Description |
| --- | --- | --- |
| mode | no | Create mode to price. Ignored when productionId is set. |
| tier | no | Quality: low, pro, or ultra. Defaults to pro when omitted. |
| length | no | Seconds to price for a Create video. Required unless productionId is set. |
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

### app_ask_question

**Ask a question.** Ask the person a structured question in the chat.

Read only. Waits for the person.

Use when:
- A choice is a short list, such as format, length, or which character.
- You need at most one or two answers before you can write a brief.

Don't use when:
- You can assume a sensible default and mention it.
- You are about to spend credits. Write a brief instead of another question.

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
