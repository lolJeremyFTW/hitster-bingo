import type { CustomTrack } from '../types/hitster';

export interface HitsterDeckTrack extends CustomTrack {
  audioPreviewUrl?: string;
  tags?: string[];
}

export const OFFICIAL_HITSTER_DECK: HitsterDeckTrack[] = [
  {
    id: 'deck_1',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    year: 1975,
    genre: 'Rock',
    spotifyUrl: 'https://open.spotify.com/track/1IER6p1v9m6eeJ2vQy3x9d',
  },
  {
    id: 'deck_2',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    year: 1982,
    genre: 'Pop',
    spotifyUrl: 'https://open.spotify.com/track/58B4bOh22Tf3SpjE5v5rB6',
  },
  {
    id: 'deck_3',
    title: 'Smells Like Teen Spirit',
    artist: 'Nirvana',
    year: 1991,
    genre: 'Grunge',
    spotifyUrl: 'https://open.spotify.com/track/58102aG9vL269Xq2mY53zF',
  },
  {
    id: 'deck_4',
    title: 'Dancing Queen',
    artist: 'ABBA',
    year: 1976,
    genre: 'Pop/Disco',
    spotifyUrl: 'https://open.spotify.com/track/0GjEh1gL0WJw2y9x5109bZ',
  },
  {
    id: 'deck_5',
    title: 'Sweet Child O\' Mine',
    artist: 'Guns N\' Roses',
    year: 1987,
    genre: 'Rock',
    spotifyUrl: 'https://open.spotify.com/track/7o2o1G25n8V1J9Y2309Z6j',
  },
  {
    id: 'deck_6',
    title: 'Wonderwall',
    artist: 'Oasis',
    year: 1995,
    genre: 'Britpop',
    spotifyUrl: 'https://open.spotify.com/track/728o25sB801mXw7e1v6m8a',
  },
  {
    id: 'deck_7',
    title: 'Mr. Brightside',
    artist: 'The Killers',
    year: 2003,
    genre: 'Indie Rock',
    spotifyUrl: 'https://open.spotify.com/track/0eGsL2O29qR92x517j3c4k',
  },
  {
    id: 'deck_8',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    year: 2019,
    genre: 'Synthpop',
    spotifyUrl: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b',
  },
  {
    id: 'deck_9',
    title: 'Africa',
    artist: 'Toto',
    year: 1982,
    genre: 'Pop/Rock',
    spotifyUrl: 'https://open.spotify.com/track/2374M0fQpWi3P9Zgaskx46',
  },
  {
    id: 'deck_10',
    title: 'Uptown Funk',
    artist: 'Mark Ronson ft. Bruno Mars',
    year: 2014,
    genre: 'Funk',
    spotifyUrl: 'https://open.spotify.com/track/32OlwWuE3fG1O895521jR7',
  }
];
