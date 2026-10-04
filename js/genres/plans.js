/*
 * "Plan this piece": a few questions per genre to answer before writing.
 * Answers are saved with the draft and shared with the coach.
 */
(function (WP) {
  'use strict';

  WP.plans = {
    comedy: [
      { id: 'topic', q: 'Topic', hint: 'What are you joking about? Something you know well.', ph: 'Self-checkout machines' },
      { id: 'attitude', q: 'Attitude', hint: 'Is it weird, scary, hard or stupid?', ph: 'Stupid' },
      { id: 'premise', q: 'Premise', hint: 'Why? The insight behind the attitude.', ph: 'They make you do the cashier’s job and then accuse you of stealing' },
      { id: 'audience', q: 'Who’s listening?', hint: 'Who should laugh: friends, a club crowd, coworkers?', ph: 'Open-mic crowd, mostly students' },
    ],
    video: [
      { id: 'viewer', q: 'Who is the viewer?', hint: 'One specific person, not “everyone”.', ph: 'A student who cooks for one on a tight budget' },
      { id: 'promise', q: 'The promise', hint: 'What will they get by the end? This becomes your hook.', ph: 'A week of lunches for $20' },
      { id: 'points', q: 'Main points', hint: 'Two to four points, best one last.', ph: 'One grain, frozen veg, two sauces' },
      { id: 'cta', q: 'One call to action', hint: 'What should they do when the video ends?', ph: 'Comment their go-to cheap meal' },
    ],
    story: [
      { id: 'character', q: 'Main character', hint: 'Name, age, one telling detail.', ph: 'Maya, 34, repairs clocks, hasn’t left her village in ten years' },
      { id: 'want', q: 'What do they want?', hint: 'Something concrete they can get or lose.', ph: 'To find out who sent her mother’s watch' },
      { id: 'obstacle', q: 'What’s in the way?', hint: 'A person, a flaw, a situation.', ph: 'Every clockmaker refuses to touch it' },
      { id: 'stakes', q: 'What happens if they fail?', hint: 'The cost makes the reader care.', ph: 'She loses the last link to her mother' },
      { id: 'change', q: 'How do they change?', hint: 'Who are they by the end?', ph: 'She leaves the village and opens her own shop' },
    ],
    novel: [
      { id: 'character', q: 'Your hero', hint: 'Name, age, and the flaw that will cause trouble.', ph: 'Mira, 26, sorts mail and never leaves her town' },
      { id: 'want', q: 'What do they want?', hint: 'The goal that drives the whole book.', ph: 'To find out what really happened to her mother' },
      { id: 'opposition', q: 'Who or what opposes them?', hint: 'A person with their own reasons is stronger than bad luck.', ph: 'The town council, who covered it up' },
      { id: 'stakes', q: 'What happens if they fail?', hint: 'Make it personal.', ph: 'She loses the truth and the only family she has left' },
      { id: 'ending', q: 'Where does it end?', hint: 'The last image. Planning the ending first makes the middle easier.', ph: 'Mira leaves Marsh End on the bus that never comes back' },
    ],
    essay: [
      { id: 'thesis', q: 'Your main point in one sentence', hint: 'A sentence someone could disagree with.', ph: 'Everyone should learn to cook five basic meals' },
      { id: 'reader', q: 'Who is the reader?', hint: 'What do they already believe?', ph: 'Busy people who think cooking takes too long' },
      { id: 'evidence', q: 'Your best evidence', hint: 'A number, a source, a story.', ph: 'My food spending dropped from $600 to $280' },
      { id: 'objection', q: 'The strongest objection', hint: 'What will a skeptic say?', ph: '“I don’t have time”' },
      { id: 'takeaway', q: 'What should the reader do after?', hint: 'The takeaway for your ending.', ph: 'Learn one meal this weekend' },
    ],
    poetry: [
      { id: 'image', q: 'The central image', hint: 'One concrete thing you can see, hear or touch.', ph: 'My father’s boots by the back door' },
      { id: 'feeling', q: 'The feeling underneath', hint: 'What is the poem really about? Don’t say it in the poem.', ph: 'Grief, and not wanting to move on' },
      { id: 'form', q: 'Form', hint: 'Free verse, haiku, sonnet… and why.', ph: 'Free verse, short lines' },
      { id: 'turn', q: 'The turn', hint: 'Where does the poem shift?', ph: 'From the boots to how we step around them' },
    ],
    copy: [
      { id: 'reader', q: 'Who exactly is reading?', hint: 'One person with one problem.', ph: 'A new parent who never has time to cook' },
      { id: 'pain', q: 'Their pain', hint: 'In their own words.', ph: '“Dinner is always takeout and guilt”' },
      { id: 'offer', q: 'What you offer', hint: 'The product and its main benefit.', ph: 'Meal kits ready in 15 minutes' },
      { id: 'proof', q: 'Proof', hint: 'Reviews, numbers, a guarantee.', ph: '4.8 stars, money-back guarantee' },
      { id: 'cta', q: 'The one action', hint: 'Written as a command.', ph: 'Get your first box free' },
    ],
    speech: [
      { id: 'audience', q: 'Who’s in the room?', hint: 'What do they know, want, worry about?', ph: 'Ray’s coworkers and family at his retirement dinner' },
      { id: 'message', q: 'Your one message', hint: 'The sentence people should repeat afterwards.', ph: 'Ray fixes things quietly and makes you feel you did it' },
      { id: 'story', q: 'Your story', hint: 'One specific moment that proves the message.', ph: 'The day I broke the printer in my first week' },
      { id: 'ending', q: 'Your last line', hint: 'A call to action, a toast or a callback.', ph: 'Raise your glasses: to Ray' },
    ],
    screenplay: [
      { id: 'logline', q: 'Logline', hint: 'One sentence: a character wants something, but…', ph: 'A nurse wants to finish her shift, but a patient won’t let her leave' },
      { id: 'want', q: 'Scene goal', hint: 'What does the main character want in this scene?', ph: 'To leave before midnight' },
      { id: 'conflict', q: 'Conflict', hint: 'Who or what stands in the way?', ph: 'The owner is locking up' },
      { id: 'turn', q: 'The turn', hint: 'How is the situation different at the end?', ph: 'He sits down and helps her fold' },
    ],
  };
})(window.WP = window.WP || {});
