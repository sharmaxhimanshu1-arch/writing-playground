/*
 * "Read like a writer": short original pieces per genre, each annotated with what it does well.
 * notes[].quote must appear in text exactly; the reader view highlights it and shows the note.
 */
(function (WP) {
  'use strict';

  WP.readings = {
    comedy: [
      {
        id: 'smart-fridge',
        title: 'My fridge has opinions',
        kind: 'Stand-up bit',
        framework: 'standup-bit',
        text: `My new fridge is smart, which is terrifying, because I am not. It has Wi-Fi, a camera and opinions.

Last night I opened it at 2 a.m. and a little voice said, "Are you sure?" I wanted a snack, but apparently I bought a mother.

It tracks everything. On Sunday it emailed me a weekly report: "You ate four yogurts and one feeling."

Now it orders groceries on its own, which is the weird part. Fourteen bags of kale arrived on Tuesday. I don't eat kale. The fridge eats kale. Turns out I just pay for its lifestyle.`,
        notes: [
          { quote: 'My new fridge is smart, which is terrifying', note: 'Premise and attitude in one breath: what the bit is about, and how the comic feels about it.' },
          { quote: 'Wi-Fi, a camera and opinions', note: 'Rule of three: two normal items build a pattern, the third breaks it.' },
          { quote: 'but apparently I bought a mother', note: 'The turn word (“but”) flips the setup, and the punch word comes last.' },
          { quote: 'four yogurts and one feeling', note: 'Specific, then absurd. “Four yogurts” makes it real; “one feeling” makes it funny.' },
          { quote: 'Turns out I just pay for its lifestyle.', note: 'The button: a final twist that flips who owns whom, ending on the surprise word.' },
        ],
        tryIt: 'Pick an object that has started to boss you around. Give it three features, the last one absurd, then end on who is really in charge.',
      },
      {
        id: 'group-chat',
        title: 'Every group chat',
        kind: 'Observational bit',
        framework: 'observational',
        text: `Every group chat has the same five people, which is weird, because nobody planned it.

The one who sends 40 messages at 1 a.m. The one who replies to a photo from three weeks ago. The one who only ever reacts with a thumbs up, like a tiny emperor.

The one who leaves, then rejoins, then leaves, which is the most annoying hobby in the world.

And you. Scrolling up for twenty minutes to find the address, only to learn Dave sent it as a voice note.`,
        notes: [
          { quote: 'Every group chat has the same five people', note: 'Observational comedy starts with something everyone has seen but nobody has listed.' },
          { quote: '40 messages at 1 a.m.', note: 'Exact numbers and times make the picture sharp. “A lot of messages” would get nothing.' },
          { quote: 'like a tiny emperor', note: 'A comparison that turns a small habit into a character.' },
          { quote: 'And you.', note: 'Turning the joke on the audience makes them laugh at themselves, which is the warmest kind of laugh.' },
          { quote: 'only to learn Dave sent it as a voice note', note: '“Only to” marks the turn, and the punch lands in the final two words.' },
        ],
        tryIt: 'Pick a place everyone knows (a gym, a queue, a wedding). List the types of people there, end on the reader, and put the funniest word last.',
      },
    ],
    video: [
      {
        id: 'onions',
        title: 'Why onions make you cry',
        kind: 'Short-form script',
        framework: 'short-form',
        text: `You're cutting onions wrong, and that's why you cry.

[CLOSE-UP: knife on onion]

When you cut an onion, you break open tiny cells. They release a gas that turns into a mild acid in your eyes.

So here's the fix. Chill the onion for ten minutes first. Cold slows the gas down.

[B-ROLL: onion going into the fridge]

Then use your sharpest knife. A clean cut breaks fewer cells than a crush.

Try it tonight, and tell me in the comments if you made it through dry-eyed.`,
        notes: [
          { quote: "You're cutting onions wrong, and that's why you cry.", note: 'The hook names the viewer (“you”) and a problem they have had, in under three seconds.' },
          { quote: '[CLOSE-UP: knife on onion]', note: 'Cues in brackets tell the editor what to show. Checks ignore them, so the spoken script stays clean.' },
          { quote: 'They release a gas that turns into a mild acid in your eyes.', note: 'One short reason before the fix. Viewers stay when they understand why.' },
          { quote: "So here's the fix.", note: 'A signpost. It tells the viewer the payoff is starting, which stops them scrolling.' },
          { quote: 'Try it tonight, and tell me in the comments', note: 'One call to action, tied to the video’s promise, with a reason to reply.' },
        ],
        tryIt: 'Pick an everyday mistake people make. Hook with “You’re doing X wrong”, give one reason, two fixes, and one call to action.',
      },
      {
        id: 'names',
        title: 'Never forget a name again',
        kind: 'Tutorial script',
        framework: 'tutorial',
        text: `You meet someone, they tell you their name, and four seconds later it's gone. Let's fix that in three steps.

## Step one: say it back
When they say "I'm Priya," answer "Nice to meet you, Priya." Saying it out loud stores it twice.

## Step two: picture it
Link the name to an image. Priya with a pear. Mark with a marker. The sillier the picture, the better it sticks.

## Step three: use it once more
Before you leave, say their name again. "Good talking to you, Priya."

That's it. Three steps, ten seconds. Subscribe for one memory trick every week.`,
        notes: [
          { quote: "four seconds later it's gone", note: 'Starts with a feeling every viewer knows. A shared problem is the strongest hook for a tutorial.' },
          { quote: "Let's fix that in three steps.", note: 'Promises a payoff and tells the viewer how long it will take. Open loops like this keep people watching.' },
          { quote: '## Step one: say it back', note: 'Headings become on-screen titles and help the checker track each segment.' },
          { quote: 'Priya with a pear. Mark with a marker.', note: 'Concrete examples make an abstract tip instantly usable.' },
          { quote: 'Three steps, ten seconds.', note: 'A one-line recap before the call to action. Easy to remember, easy to share.' },
        ],
        tryIt: 'Teach one small skill in three steps. Start with the moment the viewer struggles, give each step a heading and an example, then recap in one line.',
      },
    ],
    story: [
      {
        id: 'umbrella',
        title: 'The umbrella',
        kind: 'Flash fiction',
        framework: 'story-circle',
        text: `Every morning Mr. Okafor lent his black umbrella to whoever stood shivering at the bus stop, and every evening it came back, hooked over his gate.

For eleven years it always came back.

Then, one wet Thursday in March, it didn't. He checked the gate twice, then a third time with a torch. The street smelled of cut grass and diesel. A dog barked somewhere, the same two notes, over and over.

On Friday he bought a new umbrella and stood at the stop without opening it.

The girl beside him was soaked through, her school blazer dark with rain. She held out a folded note. "My gran said to give you this. She said thank you for every morning."

He opened the umbrella over both of them.`,
        notes: [
          { quote: 'Every morning Mr. Okafor lent his black umbrella', note: 'The opening line shows a habit, so the reader knows instantly what normal looks like, and senses it is about to break.' },
          { quote: 'For eleven years it always came back.', note: 'A one-line paragraph. Short sentences after long ones create rhythm and tension.' },
          { quote: 'then a third time with a torch', note: 'Show, don’t tell: we never read “he was worried”. His actions tell us.' },
          { quote: 'The street smelled of cut grass and diesel.', note: 'Smell and sound, not just sight. Two senses make the moment physical.' },
          { quote: 'He opened the umbrella over both of them.', note: 'The ending is an action, not an explanation. The reader feels the change without being told.' },
        ],
        tryIt: 'Give a character a small daily habit, break it once, and end with an action that shows how they changed. Don’t name a single emotion.',
      },
      {
        id: 'kitchen',
        title: 'Salt',
        kind: 'Dialogue scene',
        framework: 'three-act',
        text: `Dev set the pot down harder than he meant to. "You moved the salt."

"I cleaned," said Asha.

"It was by the stove for twenty years."

"I know where it was." She kept drying the same plate. "Mum isn't coming back to cook, Dev."

He opened three cupboards before he found it, next to the tea, in the wrong jar. The kitchen smelled of cumin and wet tea towels. He held the jar a long time.

"Leave it there." He put the jar back beside the tea.`,
        notes: [
          { quote: 'set the pot down harder than he meant to', note: 'An action beat instead of “he said angrily”. We see the anger in what he does.' },
          { quote: '"I cleaned," said Asha.', note: '“Said” disappears on the page. The reader stays with the words, not the tag.' },
          { quote: 'She kept drying the same plate.', note: 'Subtext. She is as upset as he is; she just shows it differently.' },
          { quote: "Mum isn't coming back to cook", note: 'The real argument surfaces. The fight was never about salt.' },
          { quote: 'He put the jar back beside the tea.', note: 'The change: he accepts the new kitchen, and his mother’s absence, in one small move.' },
        ],
        tryIt: 'Write two people arguing about something tiny while the real fight sits underneath. Use “said” and action beats only, and let one small object carry the ending.',
      },
    ],
    novel: [
      {
        id: 'lighthouse',
        title: 'The keeper',
        kind: 'Opening page',
        framework: 'first-chapter',
        text: `## Chapter 1

The lighthouse at Gull Point was nine years dark when Nell Hartley saw it blink.

She was on the night ferry, wedged between a crate of lemons and a man asleep on his own rucksack, and she counted the flashes the way her father had taught her. Three short. One long. Three short.

Nobody else looked up. The deck smelled of diesel and lemon peel. Somewhere below, a radio played a song she half knew.

Her father kept that light for thirty years. Then he sold the keys, signed the papers, and moved to a flat with no view of the sea.

Three short. One long. Three short.

It was his signal. It meant: come home.

Nell had buried him on Tuesday.`,
        notes: [
          { quote: 'nine years dark when Nell Hartley saw it blink', note: 'The first line raises a question (who switched it on?) and gives us the hero in one breath.' },
          { quote: 'wedged between a crate of lemons and a man asleep on his own rucksack', note: 'One sharp, specific detail sets the scene better than a paragraph of description.' },
          { quote: 'Then he sold the keys, signed the papers', note: 'Backstory in one sentence, placed just when the reader wants it, then straight back to the present.' },
          { quote: 'It was his signal. It meant: come home.', note: 'The disturbance lands. The ordinary journey has become the story.' },
          { quote: 'Nell had buried him on Tuesday.', note: 'A chapter ending that pulls: short, shocking, and impossible to stop reading after.' },
        ],
        tryIt: 'Open chapter one with something impossible happening to your hero. Keep backstory to one sentence, and end the page on a short line that changes everything.',
      },
      {
        id: 'stairs',
        title: 'The ninth stair',
        kind: 'Chapter ending',
        framework: 'scene-sequel',
        text: `## Chapter 14

Kit climbed the stairs in the dark, counting, because the ninth one creaked and the whole house would hear it.

Seven. Eight. She stepped long, over the ninth, onto the tenth.

It creaked anyway.

She froze. Below, a chair scraped. Footsteps crossed the hall, slow, unhurried, and stopped at the bottom of the stairs.

"I fixed the ninth one this morning," her uncle said. "Moved the creak up one. I thought you might come back."

The landing light clicked on.

He was holding her passport.`,
        notes: [
          { quote: 'because the ninth one creaked and the whole house would hear it', note: 'A clear, concrete goal for the scene: get upstairs without being heard.' },
          { quote: 'It creaked anyway.', note: 'Disaster, in three words. Short sentences speed up the reading when the tension peaks.' },
          { quote: 'slow, unhurried', note: 'The pace of the footsteps tells us about the uncle: he is in control, and he knows it.' },
          { quote: 'Moved the creak up one.', note: 'A reveal that rewrites the scene. He planned for her, which raises the stakes.' },
          { quote: 'He was holding her passport.', note: 'The chapter ends on a new problem, not a solution. That is what makes readers turn the page at midnight.' },
        ],
        tryIt: 'Give your character one small physical goal in a tense moment. Let it fail in a way someone planned, and end the chapter on an object that raises the stakes.',
      },
    ],
    essay: [
      {
        id: 'boredom',
        title: 'Let yourself be bored',
        kind: 'Short opinion essay',
        framework: 'prep',
        text: `Boredom is not a problem to solve. Most good ideas start there.

Before phones, a bus queue was ten minutes of nothing. Now it is ten minutes of scrolling. That trade seems harmless, but it costs us something specific: the time when the mind wanders.

Researchers call this the default mode. When we stop focusing, the brain starts connecting old memories to new problems. In one well-known study, people who did a dull task before a creativity test came up with more ideas than people who did not.

So the next time you are waiting, try leaving your phone in your pocket for the whole wait. The first minute will feel strange. After that, you may notice your own thoughts again.

Boredom is not empty time; it is thinking time that we have forgotten how to use.`,
        notes: [
          { quote: 'Boredom is not a problem to solve. Most good ideas start there.', note: 'The main point comes first, in a sentence someone could disagree with.' },
          { quote: 'Before phones, a bus queue was ten minutes of nothing.', note: 'A concrete example everyone recognises, before any theory.' },
          { quote: 'In one well-known study', note: 'Evidence. One clear finding is more convincing than many vague claims.' },
          { quote: 'So the next time you are waiting', note: 'A transition that turns the argument into something the reader can do today.' },
          { quote: 'thinking time that we have forgotten how to use', note: 'The ending restates the point in new words, so the reader leaves with one clear idea.' },
        ],
        tryIt: 'Pick a habit most people see as bad, and argue it is useful. State your point in the first line, give one example and one piece of evidence, and end with something the reader can try.',
      },
      {
        id: 'grandfather-radio',
        title: 'My grandfather’s radio',
        kind: 'Personal essay',
        framework: 'personal-essay',
        text: `My grandfather fixed radios for forty years and never once threw a part away. What he taught me is not about radios at all.

His workshop was a garage full of labelled jars: valves, knobs, screws sorted by length. As a child I thought it was clutter. Now I think it was a kind of patience.

When my laptop broke last year, the shop quoted £400 to repair it, more than a new one. I almost bought a new one. Then I remembered the jars. I found a video, ordered a small part, and fixed it on the kitchen table in an hour.

The money was never the point. What mattered was making something work again with my own hands, the way he did.

I have started my own jar. Mine holds three screws, a spare cable and a fuse. The jar is a small beginning, but it is his.`,
        notes: [
          { quote: 'My grandfather fixed radios for forty years', note: 'A personal essay starts with a specific person and a specific fact, not with a big statement about life.' },
          { quote: 'What he taught me is not about radios at all.', note: 'The point arrives in the first paragraph, as a promise the essay then keeps.' },
          { quote: 'As a child I thought it was clutter. Now I think it was a kind of patience.', note: 'Then and now. The essay is about how the writer’s view changed.' },
          { quote: 'When my laptop broke last year', note: 'A turning point in the present makes the memory matter.' },
          { quote: 'The money was never the point.', note: 'The reflection: the writer tells us what the story means, but only after showing it.' },
          { quote: 'The jar is a small beginning, but it is his.', note: 'A closing image that echoes the opening. The essay comes full circle.' },
        ],
        tryIt: 'Write about one object that belonged to someone older than you. Show what you thought of it then, what changed, and end with an image that echoes the start.',
      },
    ],
    poetry: [
      {
        id: 'night-shift',
        title: 'Night shift',
        kind: 'Free verse',
        framework: 'free',
        text: `My mother comes home
when the street lamps go out,
her shoes in one hand,
the bus still humming in her bones.

She makes toast in the dark
so she won't wake us,
butter scraped thin
as the light at the window.

I hear the kettle click
and pretend to be asleep,
because she likes to think
the morning is still hers.`,
        notes: [
          { quote: 'when the street lamps go out', note: 'A concrete image gives the time without saying “at dawn”.' },
          { quote: 'the bus still humming in her bones', note: 'A fresh image for tiredness. We feel it in the body instead of being told.' },
          { quote: 'butter scraped thin\nas the light at the window', note: 'The line break makes “thin” do double work: the butter, then the light.' },
          { quote: 'I hear the kettle click', note: 'Sound brings the reader into the room.' },
          { quote: 'the morning is still hers', note: 'The last line turns the poem: it was never about the toast, it was about love.' },
        ],
        tryIt: 'Write about someone you love doing something ordinary. Use three concrete images, no abstract words like “love” or “tired”, and let the last line turn.',
      },
      {
        id: 'three-haiku',
        title: 'Three haiku',
        kind: 'Haiku',
        framework: 'haiku',
        text: `first frost on the car
a child spells her name in ice
with one bare finger

rain on the tin roof
my grandmother's radio
loses the station

empty classroom chairs
one jumper left on the hook
still holding a shape`,
        notes: [
          { quote: 'first frost on the car', note: 'Five syllables, one seasonal image. Haiku starts in a precise moment of time.' },
          { quote: 'with one bare finger', note: 'The small physical detail makes the scene real, and the cold felt.' },
          { quote: 'loses the station', note: 'Two images side by side (rain, a lost station) let the reader feel the connection.' },
          { quote: 'still holding a shape', note: 'A turn at the end: an absent person, present in an object.' },
        ],
        tryIt: 'Write three haiku about one place at three times of day. Five, seven, five syllables; one concrete image per line; end each on a small surprise.',
      },
    ],
    copy: [
      {
        id: 'bottle',
        title: 'Keep it cold',
        kind: 'Product page',
        framework: 'pas',
        text: `## Your water is warm by 11 a.m.
You fill your bottle before work. By your first meeting, it tastes like a car seat in July.

## Meet Frost, the bottle that remembers it's cold
Double steel walls keep your water icy for 24 hours. Your first sip at 5 p.m. tastes like your first sip at 8 a.m.

You get a one-hand lid, a body that fits every cup holder, and a lifetime guarantee. Over 40,000 people already carry one.

## Try Frost for 30 days
If your water isn't still cold at the end of the day, send it back for a full refund.

Order yours today and get free delivery this week.`,
        notes: [
          { quote: 'Your water is warm by 11 a.m.', note: 'The headline names the reader’s problem, specifically, with a time on it.' },
          { quote: 'tastes like a car seat in July', note: 'Agitate the problem with a picture the reader can almost taste.' },
          { quote: 'Your first sip at 5 p.m. tastes like your first sip at 8 a.m.', note: 'A feature (steel walls) turned into a benefit the reader feels.' },
          { quote: 'Over 40,000 people already carry one.', note: 'Proof. A number makes the claim believable.' },
          { quote: 'Order yours today and get free delivery this week.', note: 'One clear call to action with a reason to act now.' },
        ],
        tryIt: 'Pick an everyday product. Write a headline that names the reader’s problem, one line that makes it vivid, the fix as a benefit, one piece of proof, and one call to action.',
      },
      {
        id: 'class-email',
        title: 'Your Saturday, sorted',
        kind: 'Email',
        framework: 'aida',
        text: `## Subject: Your Saturday, sorted
Hi Sam,

You said you wanted to learn to cook something besides pasta. This Saturday is your chance.

In our two-hour Beginner's Kitchen class, you'll make three dishes from scratch: a fresh salad, a curry, and a chocolate pot you'll want to make again on Sunday. Everything is chopped, cooked and eaten at your own station.

Last month's class gave us a 4.9 rating, and two people booked again before they left.

There are four places left. Book yours today and bring a friend for half price.

See you in the kitchen,
Lena`,
        notes: [
          { quote: 'Your Saturday, sorted', note: 'A subject line about the reader’s day, not about the business.' },
          { quote: 'You said you wanted to learn to cook something besides pasta.', note: 'Attention: it starts with the reader’s own wish, in their words.' },
          { quote: "a chocolate pot you'll want to make again on Sunday", note: 'Desire: the benefit is a future moment the reader can picture.' },
          { quote: '4.9 rating, and two people booked again before they left', note: 'Specific proof beats “our classes are popular”.' },
          { quote: 'There are four places left.', note: 'Honest urgency, then one action: book.' },
        ],
        tryIt: 'Write a short email inviting a friend to an event. Start with something they want, describe one moment they will enjoy, add one piece of proof, and ask for one action.',
      },
    ],
    speech: [
      {
        id: 'toast',
        title: 'A toast for my sister',
        kind: 'Wedding toast',
        framework: 'toast',
        text: `How do you teach your little sister to ride a bike? If you're me, you let go too early. For those I haven't met, I'm Leila, Mina's older sister.

Mina has always done things her own way. She learned to swim by jumping in. She learned to drive in a snowstorm. And she fell in love with Arjun on a train that was going the wrong way.

Arjun, I've watched you these last two years. You remember how she takes her tea, you laugh at her worst jokes, and when she gets lost, you go with her.

So please raise a glass. To Mina and Arjun: may every wrong train take you somewhere wonderful.`,
        notes: [
          { quote: "I'm Leila, Mina's older sister", note: 'Say who you are early. Half the room doesn’t know you.' },
          { quote: 'How do you teach your little sister to ride a bike?', note: 'Open with a question and a story, not “Good evening”. Introduce yourself just after.' },
          { quote: 'you let go too early', note: 'A gentle, specific joke at your own expense wins the room fast.' },
          { quote: 'She learned to swim by jumping in. She learned to drive in a snowstorm.', note: 'Rule of three with repetition: easy to say, easy to follow, and the third item is the love story.' },
          { quote: 'You remember how she takes her tea, you laugh at her worst jokes, and when she gets lost, you go with her.', note: 'Talking to the partner directly turns the toast warm and personal, and a triad gives it rhythm.' },
          { quote: 'may every wrong train take you somewhere wonderful', note: 'The ending calls back the story from the middle. Callbacks make endings feel complete.' },
        ],
        tryIt: 'Write a two-minute toast for someone you know well. Introduce yourself, tell three short stories that show who they are, talk to them directly, and end with a callback.',
      },
      {
        id: 'talk-opening',
        title: 'The ten-minute rule',
        kind: 'Talk opening',
        framework: 'ted',
        text: `Raise your hand if you have ever put off a job for a week that took ten minutes to do.

Keep it up if it was this week.

I see you. I'm one of you. Last year I avoided a single phone call for forty-one days. I counted.

Today I want to share one rule that changed that for me. It needs a timer, a task, and ten minutes. It's called the ten-minute rule, and it has three parts. First, you set a timer. Second, you only have to work until it rings. Third, when it rings, you are allowed to stop.

Here's the strange part. Almost nobody stops.`,
        notes: [
          { quote: 'Raise your hand if you have ever put off a job', note: 'Opening with a question the room can answer physically gets everyone involved in the first five seconds.' },
          { quote: 'Keep it up if it was this week.', note: 'A small laugh, earned by honesty.' },
          { quote: 'I avoided a single phone call for forty-one days. I counted.', note: 'A specific, personal story makes the speaker one of the audience.' },
          { quote: 'and it has three parts. First', note: 'Signposting tells the listener the shape of what is coming, so they can follow without notes.' },
          { quote: 'Almost nobody stops.', note: 'A short, surprising line before the main section keeps the room curious.' },
        ],
        tryIt: 'Write the first minute of a talk on a habit you changed. Open with a question the room can answer, tell one specific story, then signpost the three parts of your idea.',
      },
    ],
    screenplay: [
      {
        id: 'driving-test',
        title: 'The test',
        kind: 'Short scene',
        framework: 'scene-turn',
        text: `INT. DRIVING TEST CAR - DAY

RUBY (17) grips the wheel at ten and two. Her knuckles are white. Beside her, the EXAMINER (60s) clicks a pen.

EXAMINER
Whenever you're ready.

Ruby checks the mirror. Checks it again. Indicates. The car doesn't move.

EXAMINER (CONT'D)
You'll need to start the engine.

She turns the key. The radio blasts a love song. She stabs at it. It gets louder.

RUBY
My mum's car. She likes it loud.

The examiner reaches over and turns it off. A beat.

EXAMINER
My daughter failed four times.

RUBY
Did she pass?

EXAMINER
She's teaching you on Saturdays.

Ruby looks at him. Then she pulls out, perfectly.`,
        notes: [
          { quote: 'INT. DRIVING TEST CAR - DAY', note: 'A scene heading tells us where and when in one line.' },
          { quote: 'Her knuckles are white.', note: 'Only what a camera can film. We see her nerves instead of being told about them.' },
          { quote: 'She stabs at it. It gets louder.', note: 'Lean action lines in the present tense. Each short sentence is a shot.' },
          { quote: 'My daughter failed four times.', note: 'Subtext: he is comforting her without saying “don’t worry”.' },
          { quote: "She's teaching you on Saturdays.", note: 'The turn: a reveal that changes the scene, in five words.' },
        ],
        tryIt: 'Write a one-page scene in a small space (a car, a lift, a waiting room) where one character is nervous. Film only what a camera can see, and end on a line that turns the scene.',
      },
      {
        id: 'cold-open',
        title: 'Lights out',
        kind: 'Cold open',
        framework: 'cold-open',
        text: `EXT. VILLAGE SQUARE - NIGHT

Every window around the square glows. A church clock reads 11:59.

MRS. PATEL (70s), in a dressing gown, stands at her door with an unlit torch.

The clock ticks to midnight.

Every light in the village goes out at once. Silence.

Then, one by one, the windows light again. All except one: the empty house at the end of the square.

Mrs. Patel switches on her torch and points it at the empty house.

MRS. PATEL
Thirty years. Right on time.

She closes her door. We hold on the dark window.

Something inside it blinks back.`,
        notes: [
          { quote: 'A church clock reads 11:59.', note: 'A cold open sets a clock ticking. We know something is about to happen.' },
          { quote: 'an unlit torch', note: 'A small, filmable detail that makes us ask: what is she waiting for?' },
          { quote: 'Every light in the village goes out at once.', note: 'The hook, in one visual line. No dialogue needed.' },
          { quote: 'Thirty years. Right on time.', note: 'One short line of dialogue explains nothing and suggests everything.' },
          { quote: 'Something inside it blinks back.', note: 'End the cold open on a question, then cut to the title.' },
        ],
        tryIt: 'Write a half-page cold open with a clock, a place and one strange event. Use no more than one line of dialogue, and end on an image that asks a question.',
      },
    ],
  };
})(window.WP = window.WP || {});
