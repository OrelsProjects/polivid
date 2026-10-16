/** Copy for the three lyrics-video inputs. Placeholders show an example. Templates are pasted into a chatbot. */
export const LYRICS_INPUTS = {
  lyrics: {
    label: "Lyrics",
    placeholder: `Paste the lyrics. Use [Verse] and [Chorus] tags if you have them. Add a Style: line for the sound.

Example:
Style: 80s synth-pop, upbeat, female vocals
[Verse]
Coffee's cold, the screen is bright
Still writing code at 3 a.m. tonight
[Chorus]
Ship it, ship it, let it fly`,
    template: `Write song lyrics for a short music video.
Topic: [explain_here]
Genre and mood: [explain_here]
Singer's voice: [explain_here]
Length: about [explain_here] seconds

Answer with only this, no notes:
Style: genre, mood, tempo, instruments, vocal type
[Verse]
...
[Chorus]
...`,
  },
  director: {
    label: "Director instructions",
    placeholder: `How the camera and the performer behave for the whole video.

Example: Handheld camera. Close-ups on the chorus, slow push-ins on the verses. Warm neon light, quick cuts on the beat. The singer sings straight into the lens.`,
    template: `You are a music video director. Write director notes for a [explain_here]-second music video.
Song mood: [explain_here]
Look and feel I want: [explain_here]
Performer: [explain_here]

Answer with 4 to 8 short lines that apply to the whole video: camera angles and movement, framing (wide or close), pacing and cuts, lighting and color, and how the performer acts. No story, no lyrics, no shot numbers, no notes.`,
  },
  scene: {
    label: "Scene",
    placeholder: `Where it happens and what it looks like. Keep it to one place so every shot matches.

Example: A Tel Aviv rooftop at night, just after rain. Wet concrete, neon signs, string lights. The singer wears a black leather jacket.`,
    template: `Describe one setting for a music video so a video AI can film it the same way in every shot.
Place: [explain_here]
Time of day and weather: [explain_here]
Wardrobe: [explain_here]
Colors and mood: [explain_here]

Answer with 3 to 6 short lines in present tense: the location, set details and props, time and light, wardrobe, and colors. Only things a camera can see. No camera directions, no story, no notes.`,
  },
} as const;
