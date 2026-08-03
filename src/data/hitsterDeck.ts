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
    audioPreviewUrl: 'https://p.scdn.co/mp3-preview/b66c986c7d24268e37d8009c9966bf7bc0f82329?cid=774b68d0703e4025967e1617b4a5040f',
  },
  {
    id: 'deck_2',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    year: 1982,
    genre: 'Pop',
    spotifyUrl: 'https://open.spotify.com/track/58B4bOh22Tf3SpjE5v5rB6',
    audioPreviewUrl: 'https://p.scdn.co/mp3-preview/f7d3dfa53579b29d4d5e75ee707bbbbd6dd79ee3?cid=774b68d0703e4025967e1617b4a5040f',
  },
  {
    id: 'deck_3',
    title: 'Smells Like Teen Spirit',
    artist: 'Nirvana',
    year: 1991,
    genre: 'Grunge',
    spotifyUrl: 'https://open.spotify.com/track/58102aG9vL269Xq2mY53zF',
    audioPreviewUrl: 'https://p.scdn.co/mp3-preview/a91fa1a7a4087e599980b39922a9446d3e387c29?cid=774b68d0703e4025967e1617b4a5040f',
  },
  {
    id: 'deck_4',
    title: 'Dancing Queen',
    artist: 'ABBA',
    year: 1976,
    genre: 'Pop/Disco',
    spotifyUrl: 'https://open.spotify.com/track/0GjEh1gL0WJw2y9x5109bZ',
    audioPreviewUrl: 'https://p.scdn.co/mp3-preview/757a3e75e1136b63e8006e8b4e754a01c890bf63?cid=774b68d0703e4025967e1617b4a5040f',
  },
  {
    id: 'deck_5',
    title: 'Sweet Child O\' Mine',
    artist: 'Guns N\' Roses',
    year: 1987,
    genre: 'Rock',
    spotifyUrl: 'https://open.spotify.com/track/7o2o1G25n8V1J9Y2309Z6j',
    audioPreviewUrl: 'https://p.scdn.co/mp3-preview/0d4f58c7e6c0c22fa45e3f5b7a13d7195c8fb792?cid=774b68d0703e4025967e1617b4a5040f',
  },
  {
    id: 'deck_6',
    title: 'Wonderwall',
    artist: 'Oasis',
    year: 1995,
    genre: 'Britpop',
    spotifyUrl: 'https://open.spotify.com/track/728o25sB801mXw7e1v6m8a',
    audioPreviewUrl: 'https://p.scdn.co/mp3-preview/616b7137f8ed2666bc90bf8574d6e9a038f5f190?cid=774b68d0703e4025967e1617b4a5040f',
  },
  {
    id: 'deck_7',
    title: 'Mr. Brightside',
    artist: 'The Killers',
    year: 2003,
    genre: 'Indie Rock',
    spotifyUrl: 'https://open.spotify.com/track/0eGsL2O29qR92x517j3c4k',
    audioPreviewUrl: 'https://p.scdn.co/mp3-preview/2b9635b7194f1c93a00f28e20257e84128fef6f8?cid=774b68d0703e4025967e1617b4a5040f',
  },
  {
    id: 'deck_8',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    year: 2019,
    genre: 'Synthpop',
    spotifyUrl: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b',
    audioPreviewUrl: 'https://p.scdn.co/mp3-preview/e02c6d4e28bfb04d1668bc504a742ed4127027b3?cid=774b68d0703e4025967e1617b4a5040f',
  },
  {
    id: 'deck_9',
    title: 'Africa',
    artist: 'Toto',
    year: 1982,
    genre: 'Pop/Rock',
    spotifyUrl: 'https://open.spotify.com/track/2374M0fQpWi3P9Zgaskx46',
    audioPreviewUrl: 'https://p.scdn.co/mp3-preview/2b9635b7194f1c93a00f28e20257e84128fef6f8?cid=774b68d0703e4025967e1617b4a5040f',
  },
  {
    id: 'deck_10',
    title: 'Uptown Funk',
    artist: 'Mark Ronson ft. Bruno Mars',
    year: 2014,
    genre: 'Funk',
    spotifyUrl: 'https://open.spotify.com/track/32OlwWuE3fG1O895521jR7',
    audioPreviewUrl: 'https://p.scdn.co/mp3-preview/5a2d677ec23f5b7a13d7195c8fb792?cid=774b68d0703e4025967e1617b4a5040f',
  }
];
