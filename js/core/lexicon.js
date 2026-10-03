/* Word lists shared by the checks. Kept small and opinionated on purpose. */
(function (WP) {
  'use strict';

  WP.lex = {
    stopwords: new Set(('a an the and or but so of to in on at by for with from as is are was were be been being am ' +
      'it its it\'s this that these those there here i me my mine you your yours he him his she her hers we us our ' +
      'they them their what which who whom whose when where why how not no yes do does did done have has had ' +
      'will would can could should shall may might must just very really than then too also up down out over ' +
      'into about if because while all any some each every more most much many such only own same other ' +
      'like get got go goes went one two now well even still back way thing things know think said say says ' +
      'i\'m you\'re don\'t can\'t it\'s that\'s i\'ve i\'d i\'ll didn\'t isn\'t wasn\'t doesn\'t').split(/\s+/)),

    filler: ['very', 'really', 'just', 'actually', 'basically', 'literally', 'totally', 'quite', 'rather',
      'somewhat', 'kind of', 'sort of', 'pretty much', 'a bit', 'a little bit', 'in order to', 'definitely',
      'certainly', 'simply', 'truly', 'honestly', 'obviously', 'clearly', 'seriously'],

    adverbExceptions: new Set(['only', 'early', 'family', 'reply', 'apply', 'supply', 'fly', 'july', 'italy',
      'belly', 'bully', 'holy', 'ugly', 'silly', 'lonely', 'lovely', 'friendly', 'likely', 'daily', 'weekly',
      'monthly', 'yearly', 'jelly', 'rally', 'ally', 'lily', 'sally', 'billy', 'kelly', 'emily', 'molly',
      'holly', 'jolly', 'curly', 'chilly', 'hilly', 'oily', 'smelly', 'costly', 'elderly', 'deadly', 'lively',
      'reply', 'multiply', 'imply', 'comply', 'rely', 'bodily', 'wily', 'surly', 'burly', 'woolly', 'anomaly',
      'assembly', 'butterfly', 'dragonfly', 'monopoly', 'homily', 'melancholy', 'ally', 'tally', 'gully']),

    cliches: ['at the end of the day', 'avoid it like the plague', 'all walks of life', 'better late than never',
      'beyond the shadow of a doubt', 'crystal clear', 'easier said than done', 'every cloud has a silver lining',
      'few and far between', 'in the nick of time', 'last but not least', 'think outside the box',
      'only time will tell', 'the calm before the storm', 'when all is said and done', 'time will tell',
      'a blessing in disguise', 'it goes without saying', 'needle in a haystack', 'piece of cake',
      'heart of gold', 'cold as ice', 'dead as a doornail', 'fit as a fiddle', 'plenty of fish in the sea',
      'scared to death', 'sigh of relief', 'hit the ground running', 'low-hanging fruit', 'game changer',
      'game-changer', 'paradigm shift', 'move the needle', 'at this point in time', 'in this day and age',
      'since the dawn of time', 'all of a sudden', 'tip of the iceberg', 'the bottom line', 'level playing field',
      'a perfect storm', 'stood the test of time', 'little did they know', 'little did i know',
      'it was a dark and stormy night', 'once upon a time', 'like a kid in a candy store', 'broken heart',
      'tears streamed down', 'let out a breath', 'let out a breath she didn\'t know she was holding',
      'a breath he didn\'t know he was holding', 'in the blink of an eye', 'butterflies in my stomach',
      'butterflies in her stomach', 'heart skipped a beat', 'blood ran cold', 'time stood still',
      'dark night of the soul', 'deafening silence', 'raining cats and dogs', 'the rest is history',
      'think out of the box', 'go the extra mile', 'take it to the next level', 'next level'],

    filterWords: ['felt', 'feel', 'feels', 'feeling', 'saw', 'see', 'sees', 'seeing', 'heard', 'hear', 'hears',
      'noticed', 'notice', 'notices', 'realized', 'realised', 'realize', 'realizes', 'wondered', 'wonder',
      'thought', 'seemed', 'seem', 'seems', 'watched', 'decided', 'knew', 'could see', 'could hear',
      'could feel', 'looked at', 'smelled', 'tasted', 'experienced'],

    emotions: ['angry', 'sad', 'happy', 'scared', 'afraid', 'nervous', 'excited', 'anxious', 'upset',
      'furious', 'terrified', 'depressed', 'lonely', 'jealous', 'frustrated', 'embarrassed', 'ashamed',
      'confused', 'surprised', 'shocked', 'worried', 'relieved', 'disappointed', 'heartbroken', 'overjoyed',
      'devastated', 'annoyed', 'proud', 'guilty', 'hopeful', 'bored', 'tense', 'calm', 'content', 'miserable',
      'elated', 'thrilled', 'horrified', 'stressed', 'grateful', 'irritated', 'panicked', 'sorry'],

    senses: {
      sight: ['glint', 'glow', 'gleam', 'shadow', 'shimmer', 'flicker', 'blaze', 'pale', 'crimson', 'scarlet',
        'golden', 'grey', 'gray', 'blue', 'green', 'red', 'yellow', 'violet', 'amber', 'silver', 'dim', 'bright',
        'glare', 'sparkle', 'haze', 'blur', 'faded', 'stained', 'freckled', 'speckled', 'neon', 'flash',
        'dusty', 'murky', 'gleaming', 'glittering', 'shining', 'black', 'white', 'orange', 'purple', 'brown'],
      sound: ['hum', 'buzz', 'crack', 'crackle', 'creak', 'click', 'clang', 'whisper', 'whispered', 'murmur',
        'rumble', 'roar', 'hiss', 'thud', 'thump', 'bang', 'rattle', 'ring', 'ringing', 'chime', 'shriek',
        'scream', 'groan', 'squeak', 'snap', 'sizzle', 'drone', 'echo', 'echoed', 'silence', 'silent', 'loud',
        'quiet', 'hush', 'clatter', 'jingle', 'tick', 'ticking', 'beep', 'howl', 'wail', 'purr', 'crunch',
        'hissed', 'hissing', 'clicked', 'clicking', 'buzzing', 'humming', 'hummed', 'creaked', 'creaking', 'crackled',
        'crackling', 'thudded', 'rattled', 'rattling', 'whispering', 'rang', 'roared', 'rumbled', 'banged', 'squeaked'],
      smell: ['smell', 'smelled', 'scent', 'stink', 'stench', 'reek', 'aroma', 'perfume', 'musty', 'smoky',
        'rotten', 'fragrant', 'sour', 'acrid', 'odor', 'odour', 'whiff', 'mildew', 'bleach', 'sweat', 'garlic',
        'coffee', 'smoke', 'incense', 'rot', 'damp'],
      taste: ['taste', 'tasted', 'bitter', 'sweet', 'salty', 'salt', 'savory', 'tangy', 'spicy', 'sugary',
        'metallic', 'bland', 'tart', 'honey', 'vinegar', 'chewed', 'swallowed', 'sip', 'sipped', 'gulp', 'lick'],
      touch: ['rough', 'smooth', 'sticky', 'slick', 'slimy', 'soft', 'hard', 'cold', 'warm', 'hot', 'icy',
        'damp', 'wet', 'dry', 'gritty', 'prickly', 'velvet', 'silky', 'coarse', 'sharp', 'blunt', 'heavy',
        'greasy', 'itchy', 'numb', 'sting', 'stung', 'ache', 'ached', 'throb', 'burn', 'brush', 'brushed',
        'squeeze', 'squeezed', 'grip', 'gripped', 'tingle', 'shiver', 'clammy', 'frozen', 'feverish'],
    },

    vague: ['thing', 'things', 'stuff', 'something', 'someone', 'somebody', 'somewhere', 'somehow', 'whatever',
      'a lot', 'lots of', 'various', 'certain', 'many', 'some', 'people', 'nice', 'good', 'bad', 'great',
      'amazing', 'awesome', 'interesting', 'whatnot', 'and so on', 'and stuff'],

    fancyTags: ['exclaimed', 'retorted', 'chortled', 'quipped', 'opined', 'interjected', 'ejaculated',
      'hissed', 'growled', 'snarled', 'barked', 'chirped', 'chuckled', 'laughed', 'giggled', 'sneered',
      'snorted', 'smirked', 'breathed', 'sighed', 'gasped', 'proclaimed', 'declared', 'stated', 'uttered',
      'remarked', 'mused', 'queried', 'inquired', 'enquired', 'responded', 'replied', 'commented', 'admonished',
      'implored', 'cajoled', 'bellowed', 'roared', 'thundered', 'spat', 'grinned', 'beamed'],

    transitions: ['however', 'therefore', 'for example', 'for instance', 'in contrast', 'as a result',
      'on the other hand', 'in addition', 'moreover', 'furthermore', 'consequently', 'meanwhile', 'instead',
      'similarly', 'likewise', 'nevertheless', 'nonetheless', 'first', 'second', 'third', 'finally', 'next',
      'then', 'because', 'so', 'that means', 'which means', 'in other words', 'even so', 'still', 'yet',
      'after all', 'specifically', 'in short', 'that said', 'otherwise', 'besides', 'above all', 'in fact'],

    weasel: ['some people say', 'many people believe', 'many believe', 'it is said', 'it is believed',
      'studies show', 'research shows', 'experts say', 'experts agree', 'everyone knows', 'it is widely known',
      'arguably', 'it could be argued', 'some would say', 'they say', 'needless to say', 'it seems that',
      'it appears that', 'in my opinion', 'i think that', 'i believe that', 'i feel that'],

    buzzwords: ['synergy', 'synergies', 'leverage', 'leveraging', 'cutting-edge', 'cutting edge', 'innovative',
      'world-class', 'best-in-class', 'best of breed', 'robust', 'seamless', 'seamlessly', 'next-generation',
      'revolutionary', 'disruptive', 'holistic', 'scalable', 'turnkey', 'paradigm', 'empower', 'empowering',
      'solutions', 'state-of-the-art', 'value-added', 'mission-critical', 'bleeding-edge', 'ecosystem',
      'unlock your potential', 'take it to the next level', 'one-stop shop', 'utilize', 'utilise'],

    powerWords: ['free', 'new', 'proven', 'instantly', 'instant', 'easy', 'secret', 'guaranteed', 'exclusive',
      'limited', 'discover', 'save', 'results', 'today', 'now', 'fast', 'simple', 'imagine', 'because',
      'finally', 'never', 'surprising', 'effortless', 'bonus', 'only', 'last chance', 'you'],

    passiveIrregulars: ['been', 'born', 'bought', 'brought', 'built', 'caught', 'chosen', 'done', 'drawn',
      'driven', 'eaten', 'fallen', 'felt', 'forgotten', 'forgiven', 'found', 'frozen', 'given', 'gone',
      'grown', 'heard', 'held', 'hidden', 'hit', 'hurt', 'kept', 'known', 'laid', 'led', 'left', 'lost',
      'made', 'meant', 'met', 'paid', 'put', 'read', 'ridden', 'run', 'said', 'seen', 'sent', 'set', 'shaken',
      'shown', 'shut', 'sold', 'spent', 'spoken', 'stolen', 'struck', 'sung', 'taken', 'taught', 'thrown',
      'told', 'torn', 'understood', 'woken', 'won', 'worn', 'written', 'beaten', 'bitten', 'blown', 'broken',
      'cut', 'dealt', 'dug', 'fed', 'fought', 'forbidden', 'hung', 'shot', 'slain', 'sworn', 'swept', 'thought'],

    passiveExceptions: new Set(['tired', 'excited', 'interested', 'bored', 'married', 'used', 'supposed',
      'located', 'based', 'concerned', 'pleased', 'prepared', 'surprised', 'embarrassed', 'confused',
      'satisfied', 'disappointed', 'annoyed', 'worried', 'scared', 'amazed', 'determined', 'involved',
      'related', 'allowed', 'needed', 'done', 'gone', 'left', 'set', 'put', 'hurt', 'read', 'felt', 'said',
      'thought', 'tied', 'shocked', 'stressed', 'relieved', 'convinced', 'obsessed', 'qualified', 'retired',
      'inspired', 'exhausted', 'frustrated', 'thrilled', 'terrified', 'overwhelmed', 'crowded', 'closed',
      'finished', 'red', 'bed', 'shed', 'sled', 'wed', 'need', 'seed', 'feed', 'speed', 'indeed', 'freed']),

    abstractWords: ['love', 'hope', 'soul', 'heart', 'pain', 'beauty', 'eternity', 'destiny', 'dream', 'dreams',
      'despair', 'joy', 'sorrow', 'truth', 'freedom', 'darkness', 'light', 'forever', 'infinite', 'spirit',
      'passion', 'emotion', 'emotions', 'feelings', 'fate', 'grief', 'happiness', 'sadness', 'loneliness',
      'peace', 'time', 'life', 'death', 'universe', 'existence', 'memories', 'memory'],

    poeticCliches: ['heart of stone', 'tears like rain', 'broken heart', 'dark night', 'endless sky',
      'raging storm', 'shining star', 'deep blue sea', 'burning desire', 'fire within', 'cold heart',
      'like a rose', 'my heart bleeds', 'whispering wind', 'silent tears', 'golden sun', 'silver moon',
      'sea of tears', 'river of tears', 'eyes like stars', 'lips like roses', 'to the end of time',
      'love is blind', 'heart and soul', 'shattered heart', 'darkest hour', 'endless night'],

    youWords: /\b(you|your|yours|you're|you’re|yourself|you'll|you’ll|you've|you’ve)\b/gi,
    meWords: /\b(i|me|my|mine|myself|i'm|i’m|i've|i’ve|i'll|i’ll|i'd|i’d)\b/gi,
    weWords: /\b(we|our|ours|us|we're|we’re|we've|we’ve|we'll|we’ll|ourselves)\b/gi,
  };
})(window.WP = window.WP || {});
