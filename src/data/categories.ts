import type { BingoCategory } from '../types/hitster';

export const SIDE_A_CATEGORIES: BingoCategory[] = [
  {
    id: 'cat_60s',
    titleNl: 'Jaren 60 & Ouder',
    titleEn: '1960s & Older',
    descNl: 'Nummer is uitgebracht in 1969 of eerder.',
    descEn: 'Song was released in 1969 or earlier.',
    iconName: 'Disc',
    color: 'from-amber-500 to-yellow-600',
    tags: ['decade', '60s']
  },
  {
    id: 'cat_70s',
    titleNl: 'Jaren 70 Classic',
    titleEn: '1970s Classic',
    descNl: 'Nummer is uitgebracht tussen 1970 en 1979 (Disco, Rock, Funk era).',
    descEn: 'Song released between 1970 and 1979.',
    iconName: 'Sparkles',
    color: 'from-orange-500 to-amber-600',
    tags: ['decade', '70s']
  },
  {
    id: 'cat_80s',
    titleNl: 'Jaren 80 Hit',
    titleEn: '1980s Hit',
    descNl: 'Nummer is uitgebracht tussen 1980 en 1989 (Synthpop, New Wave era).',
    descEn: 'Song released between 1980 and 1989.',
    iconName: 'Zap',
    color: 'from-purple-500 to-pink-600',
    tags: ['decade', '80s']
  },
  {
    id: 'cat_90s',
    titleNl: 'Jaren 90 Jam',
    titleEn: '1990s Jam',
    descNl: 'Nummer is uitgebracht tussen 1990 en 1999 (Eurodance, Grunge, Boybands).',
    descEn: 'Song released between 1990 and 1999.',
    iconName: 'Radio',
    color: 'from-cyan-500 to-blue-600',
    tags: ['decade', '90s']
  },
  {
    id: 'cat_00s',
    titleNl: 'Jaren 2000 (00s)',
    titleEn: '2000s Smash',
    descNl: 'Nummer is uitgebracht tussen 2000 en 2009.',
    descEn: 'Song released between 2000 and 2009.',
    iconName: 'Music',
    color: 'from-emerald-500 to-teal-600',
    tags: ['decade', '00s']
  },
  {
    id: 'cat_10s_newer',
    titleNl: '2010 of Nieuwer',
    titleEn: '2010 or Newer',
    descNl: 'Nummer is uitgebracht in 2010 of later.',
    descEn: 'Song released in 2010 or later.',
    iconName: 'Flame',
    color: 'from-rose-500 to-red-600',
    tags: ['decade', '10s']
  },
  {
    id: 'cat_before_1990',
    titleNl: 'Vóór 1990',
    titleEn: 'Before 1990',
    descNl: 'Uitgebracht voor 1 januari 1990.',
    descEn: 'Released before Jan 1, 1990.',
    iconName: 'History',
    color: 'from-amber-600 to-orange-700',
    tags: ['year_range']
  },
  {
    id: 'cat_after_2000',
    titleNl: 'Na 2000',
    titleEn: 'After 2000',
    descNl: 'Uitgebracht na 31 december 1999.',
    descEn: 'Released after Dec 31, 1999.',
    iconName: 'Forward',
    color: 'from-indigo-500 to-purple-600',
    tags: ['year_range']
  },
  {
    id: 'cat_singalong',
    titleNl: 'Meezingplaat!',
    titleEn: 'Sing-Along Hit!',
    descNl: 'Iedereen om het kampvuur zingt spontaan mee met het refrein.',
    descEn: 'Everyone around the campfire sings along with the chorus.',
    iconName: 'Volume2',
    color: 'from-yellow-400 to-amber-500',
    tags: ['trait']
  },
  {
    id: 'cat_rock_guitar',
    titleNl: 'Gitaar & Rock',
    titleEn: 'Guitar & Rock',
    descNl: 'Bevat een bekende gitaarsolo of rock elementen.',
    descEn: 'Features a guitar solo or rock sound.',
    iconName: 'Flame',
    color: 'from-red-600 to-rose-700',
    tags: ['genre']
  },
  {
    id: 'cat_dutch_euro',
    titleNl: 'Nederlands / Europees',
    titleEn: 'Dutch / European Hit',
    descNl: 'Artiest of band is afkomstig uit Nederland of Europa.',
    descEn: 'Artist or band comes from Netherlands or Europe.',
    iconName: 'Globe',
    color: 'from-blue-500 to-indigo-600',
    tags: ['origin']
  },
  {
    id: 'cat_female_artist',
    titleNl: 'Solo Zangeres',
    titleEn: 'Solo Female Artist',
    descNl: 'Gezongen door een vrouwelijke solo-artiest.',
    descEn: 'Sung by a solo female vocalist.',
    iconName: 'Mic',
    color: 'from-pink-500 to-rose-600',
    tags: ['artist']
  },
  {
    id: 'cat_male_artist',
    titleNl: 'Solo Zanger',
    titleEn: 'Solo Male Artist',
    descNl: 'Gezongen door een mannelijke solo-artiest.',
    descEn: 'Sung by a solo male vocalist.',
    iconName: 'User',
    color: 'from-blue-600 to-cyan-700',
    tags: ['artist']
  },
  {
    id: 'cat_duet_band',
    titleNl: 'Duet of Band (>2 leden)',
    titleEn: 'Duet or Band',
    descNl: 'Uitgevoerd door een samenwerking, duet of band.',
    descEn: 'Performed by a band, group, or duet.',
    iconName: 'Users',
    color: 'from-purple-600 to-violet-700',
    tags: ['artist']
  },
  {
    id: 'cat_movie_tv',
    titleNl: 'Film of TV Hit',
    titleEn: 'Movie or TV Hit',
    descNl: 'Groot succes uit een film soundtrack of tv-serie.',
    descEn: 'Famous theme from a soundtrack or movie.',
    iconName: 'Film',
    color: 'from-teal-500 to-emerald-600',
    tags: ['theme']
  },
  {
    id: 'cat_summer_vibes',
    titleNl: 'Zomerse Hit',
    titleEn: 'Summer Vibes',
    descNl: 'Vrolijk zomers feestnummer of strand classic.',
    descEn: 'Upbeat summer anthem or tropical hit.',
    iconName: 'Sun',
    color: 'from-amber-400 to-yellow-500',
    tags: ['vibe']
  }
];

export const SIDE_B_CATEGORIES: BingoCategory[] = [
  {
    id: 'cat_exact_decade',
    titleNl: 'Exact Decennium Goed',
    titleEn: 'Exact Decade Correct',
    descNl: 'Je hebt het exacte decennium van de release goed geraden.',
    descEn: 'You guessed the exact decade of the release.',
    iconName: 'CheckCircle2',
    color: 'from-emerald-600 to-green-700',
    tags: ['expert']
  },
  {
    id: 'cat_before_host_born',
    titleNl: 'Ouder dan de Host',
    titleEn: 'Older than Host',
    descNl: 'Uitgebracht in een jaar vóór het geboortejaar van de Spelleider/Host.',
    descEn: 'Released before the game host was born.',
    iconName: 'Calendar',
    color: 'from-amber-700 to-orange-800',
    tags: ['expert']
  },
  {
    id: 'cat_one_hit_wonder',
    titleNl: 'Eendagsvlieg (One-Hit)',
    titleEn: 'One-Hit Wonder',
    descNl: 'Artiest met hoofdzakelijk één gigantische werelrhit.',
    descEn: 'Artist known primarily for one massive hit.',
    iconName: 'Star',
    color: 'from-purple-500 to-pink-500',
    tags: ['expert']
  },
  {
    id: 'cat_one_word_title',
    titleNl: 'Titel met 1 Woord',
    titleEn: '1-Word Title',
    descNl: 'De songtitel bestaat uit precies 1 woord (bijv. "Angels", "Toxic").',
    descEn: 'Song title is exactly one word.',
    iconName: 'FileText',
    color: 'from-blue-600 to-indigo-700',
    tags: ['expert']
  },
  {
    id: 'cat_name_or_place',
    titleNl: 'Naam of Plaats in Titel',
    titleEn: 'Name or Place in Title',
    descNl: 'Songtitel bevat een persoonsnaam of stads/landnaam (bijv. "Jolene", "Africa").',
    descEn: 'Title contains a person name or location.',
    iconName: 'MapPin',
    color: 'from-rose-600 to-red-700',
    tags: ['expert']
  },
  {
    id: 'cat_number_one_hit',
    titleNl: 'Nummer 1 Hit',
    titleEn: 'Number 1 Hit',
    descNl: 'Nummer heeft op #1 gestaan in de Top 40 of Single Top 100.',
    descEn: 'Song reached #1 on official music charts.',
    iconName: 'Trophy',
    color: 'from-yellow-400 to-amber-500',
    tags: ['expert']
  },
  {
    id: 'cat_leap_year',
    titleNl: 'Schrikkeljaar Release',
    titleEn: 'Leap Year Release',
    descNl: 'Uitgebracht in een schrikkeljaar (bijv. 1980, 1984, 1988, 1992, 1996, 2000, 2004, 2008, 2012, 2016, 2020, 2024).',
    descEn: 'Released in a leap year (e.g. 1984, 1996, 2000, 2012, 2020).',
    iconName: 'HelpCircle',
    color: 'from-cyan-600 to-teal-700',
    tags: ['expert']
  },
  {
    id: 'cat_long_song',
    titleNl: 'Langer dan 4 Minuten',
    titleEn: 'Song Over 4 Minutes',
    descNl: 'Totale tijdsduur van het nummer is langer dan 4:00 minuten.',
    descEn: 'Song duration is longer than 4 minutes.',
    iconName: 'Clock',
    color: 'from-indigo-600 to-purple-700',
    tags: ['expert']
  },
  {
    id: 'cat_acoustic_ballad',
    titleNl: 'Akoestisch / Ballad',
    titleEn: 'Acoustic / Slow Jam',
    descNl: 'Rustig nummer, ballad of akoestische uitvoering.',
    descEn: 'Slow song, ballad, or acoustic guitar focus.',
    iconName: 'Heart',
    color: 'from-pink-600 to-rose-700',
    tags: ['expert']
  },
  {
    id: 'cat_exact_year',
    titleNl: 'Exact Jaartal Geraden!',
    titleEn: 'Exact Year Guessed!',
    descNl: 'Speler/team heeft het exacte releasejaar 100% goed geraden!',
    descEn: 'Player guessed the exact release year correctly!',
    iconName: 'Award',
    color: 'from-yellow-500 to-amber-600',
    tags: ['expert']
  },
  {
    id: 'cat_timeline_placement',
    titleNl: 'Juiste Plek op Tijdlijn',
    titleEn: 'Correct Timeline Position',
    descNl: 'De kaart is succesvol op de juiste chronologische plek gelegd.',
    descEn: 'The card was successfully placed in correct timeline position.',
    iconName: 'Layers',
    color: 'from-emerald-500 to-teal-600',
    tags: ['expert']
  },
  {
    id: 'cat_color_in_title',
    titleNl: 'Kleur in de Titel',
    titleEn: 'Color in Title',
    descNl: 'Titel bevat een kleur (bijv. "Blue Suede Shoes", "Yellow Submarine", "Red Red Wine").',
    descEn: 'Title contains a color (e.g. Red, Blue, Yellow, Purple).',
    iconName: 'Palette',
    color: 'from-violet-500 to-fuchsia-600',
    tags: ['expert']
  },
  {
    id: 'cat_disco_dance',
    titleNl: 'Disco / Dance Classic',
    titleEn: 'Disco / Dance Classic',
    descNl: 'Aanstekelijke disco, eurodance of electro dance track.',
    descEn: 'Upbeat disco, Eurodance, or dance classic.',
    iconName: 'Disc',
    color: 'from-amber-400 to-orange-500',
    tags: ['expert']
  },
  {
    id: 'cat_cover_bside',
    titleNl: 'Cover of B-Kantje',
    titleEn: 'Cover Song',
    descNl: 'Het nummer is een beroemde cover van een ander origineel.',
    descEn: 'The song is a famous cover version.',
    iconName: 'Repeat',
    color: 'from-slate-600 to-gray-700',
    tags: ['expert']
  }
];

export const CAMPFIRE_EXTRA_CATEGORIES: BingoCategory[] = [
  {
    id: 'cat_campfire_singing',
    titleNl: 'Kampvuur Koor!',
    titleEn: 'Campfire Chorus!',
    descNl: 'Minstens 3 mensen zingen hardop mee om het kampvuur.',
    descEn: 'At least 3 people sing along out loud around the campfire.',
    iconName: 'Flame',
    color: 'from-orange-500 to-red-600',
    tags: ['campfire']
  },
  {
    id: 'cat_within_2_years',
    titleNl: 'Binnen 2 Jaar Geraden',
    titleEn: 'Guessed Within 2 Years',
    descNl: 'Je gok zat er maximaal 2 jaar naast.',
    descEn: 'Your year guess was within 2 years of actual release.',
    iconName: 'Target',
    color: 'from-amber-500 to-yellow-600',
    tags: ['campfire']
  },
  {
    id: 'cat_toast_song',
    titleNl: 'Proost Nummer! 🍻',
    titleEn: 'Cheers Song! 🍻',
    descNl: 'Iedereen neemt een slok van z\'n drankje bij dit nummer.',
    descEn: 'Everyone takes a sip of their drink during this song.',
    iconName: 'Sparkles',
    color: 'from-amber-400 to-amber-600',
    tags: ['campfire']
  },
  {
    id: 'cat_older_than_40',
    titleNl: 'Ouder dan 40 Jaar',
    titleEn: 'Older than 40 Years',
    descNl: 'Nummer is meer dan 40 jaar geleden uitgebracht.',
    descEn: 'Song was released more than 40 years ago.',
    iconName: 'Clock',
    color: 'from-stone-500 to-neutral-700',
    tags: ['campfire']
  }
];
