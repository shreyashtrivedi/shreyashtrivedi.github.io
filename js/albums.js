// The songs and album covers for each project record (six per project).
//
// Every time a visitor opens the projects section (or reloads the page), each project picks one
// entry from its list at random: that song plays in Spotify's player and its cover fills the page.
// While the section stays open, moving between records keeps the same picks; closing and opening
// it again draws new ones (never the same song twice in a row when a project has more than one).
//
// Keys are project ids from `projects` in content.js. Each entry:
//   song       track name, as shown on the page
//   spotify    the track id: the part after open.spotify.com/track/ in the share link (before any ?si=…)
//   title      the album the song is from
//   artist     the artist
//   year       the album's release year
//   label      the record label (shown in the small print)
//   art        the cover image, in assets/covers/<project id>/ (square, 1000px+, jpg)
// Optional:
//   artCredit  credit for the image when it isn't the album's own cover
//   accent     a highlight colour for the page; picked from the cover automatically if left out
//   ring       the colour of the title's outline, if not the accent
//   focus      which part of the cover stays in view, as a CSS position ('50% 30%'): the cover fills the
//              whole screen, so wide screens trim its top and bottom (the second number picks the band)
//              and phones trim its sides (the first number)
//   painting   credit for cover art that is a painting
//   listen     the "Listen" link; defaults to the song on Spotify
//
// Covers are the album artwork as shown on Spotify, except where `artCredit` says otherwise.
// Album artwork is copyrighted by its label; it is shown as a credited tribute.
window.ALBUMS = {
  'leash': [
    {
      song: 'Selfless', spotify: '2t0wwvR15fc3K1ey8OiOaN', title: 'The New Abnormal', artist: 'The Strokes', year: '2020', label: 'Cult / RCA',
      art: 'assets/covers/the-new-abnormal.jpg', painting: 'Jean-Michel Basquiat, Bird on Money (1981)', focus: '50% 30%',
      accent: '#f7c21b',
    },
    {
      song: 'Hey Jude', spotify: '0aym2LBJBk9DAYuHHutrIl', title: '1', artist: 'The Beatles', year: '2000', label: 'Apple Corps / Calderstone',
      art: 'assets/covers/leash/hey-jude.jpg', focus: '50% 45%',
    },
    {
      song: 'Don’t Let Me Down', spotify: '3evG0BIqEFMMP7lVJh1cSf', title: 'The Beatles 1967–1970 (Remastered 2009)', artist: 'The Beatles', year: '1973', label: 'Apple Corps / Calderstone',
      art: 'assets/covers/leash/dont-let-me-down.jpg', focus: '45% 55%',
    },
    {
      song: 'Like a Rolling Stone', spotify: '3AhXZa8sUQht0UEdBJgpGc', title: 'Highway 61 Revisited', artist: 'Bob Dylan', year: '1965', label: 'Columbia',
      art: 'assets/covers/leash/like-a-rolling-stone.jpg', artCredit: 'Bob Dylan, Like a Rolling Stone (artwork from Fine Art America)', focus: '50% 2%',
    },
    {
      song: 'Piano Man', spotify: '70C4NyhjD5OZUMzvWZ3njJ', title: 'Piano Man', artist: 'Billy Joel', year: '1973', label: 'Columbia',
      art: 'assets/covers/leash/piano-man.jpg', focus: '50% 40%',
    },
    {
      song: 'Ain’t No Sunshine', spotify: '1k1Bqnv2R0uJXQN4u6LKYt', title: 'Just As I Am', artist: 'Bill Withers', year: '1971', label: 'Sussex / Sony Music',
      art: 'assets/covers/leash/aint-no-sunshine.jpg', focus: '15% 15%',
    },
  ],

  'rgipt-assistant': [
    {
      song: 'I Love You So', spotify: '4SqWKzw0CbA05TGszDgMlc', title: 'Songs for Dads', artist: 'The Walters', year: '2014', label: 'self-released',
      art: 'assets/covers/songs-for-dads.jpg', accent: '#e8dcc0', ring: '#141414', focus: '50% 45%',
    },
    {
      song: 'Wish You Were Here', spotify: '6mFkJmJqdDVQ1REhVfGgd1', title: 'Wish You Were Here', artist: 'Pink Floyd', year: '1975', label: 'Pink Floyd Music / Sony Music',
      art: 'assets/covers/rgipt-assistant/wish-you-were-here.jpg', artCredit: 'Pink Floyd, Wish You Were Here (full-bleed rendition of the album cover)', focus: '50% 0%',
    },
    {
      song: 'Name of Love', spotify: '1y9QiBBJynizfLbYjHM2Sg', title: 'Name of Love', artist: 'cinema staff', year: '2019', label: 'Pony Canyon',
      art: 'assets/covers/rgipt-assistant/name-of-love.jpg', artCredit: 'Mikasa Ackerman, from Attack on Titan', focus: '45% 40%',
    },
    {
      song: 'Creep', spotify: '6b2oQwSGFkzsMtQruIWm2p', title: 'Pablo Honey', artist: 'Radiohead', year: '1993', label: 'XL Recordings',
      art: 'assets/covers/rgipt-assistant/creep.jpg', focus: '50% 50%',
    },
    {
      song: 'Bohemian Rhapsody', spotify: '3z8h0TU7ReDPLIbEnYhWZb', title: 'Bohemian Rhapsody (The Original Soundtrack)', artist: 'Queen', year: '2018', label: 'Queen Productions / Universal',
      art: 'assets/covers/rgipt-assistant/bohemian-rhapsody.jpg', focus: '50% 18%',
    },
    {
      song: 'Nothing Else Matters', spotify: '0nLiqZ6A27jJri2VCalIUs', title: 'Metallica', artist: 'Metallica', year: '1991', label: 'Blackened',
      art: 'assets/covers/rgipt-assistant/nothing-else-matters.jpg', artCredit: 'Metallica, Nothing Else Matters (S&M single, 1999)', focus: '45% 6%',
    },
  ],

  'edify': [
    {
      song: 'Why Georgia', spotify: '1c7UYTut2SBOPq64o2t0uN', title: 'Room for Squares', artist: 'John Mayer', year: '2001', label: 'Aware / Columbia',
      art: 'assets/covers/room-for-squares.jpg', accent: '#d39a4e', focus: '50% 40%',
    },
    {
      song: 'Vienna', spotify: '4U45aEWtQhrm8A5mxPaFZ7', title: 'The Stranger', artist: 'Billy Joel', year: '1977', label: 'Columbia',
      art: 'assets/covers/edify/vienna.jpg', focus: '60% 4%',
    },
    {
      song: 'Iris', spotify: '6Qyc6fS4DsZjB2mRW9DsQs', title: 'Dizzy Up the Girl', artist: 'The Goo Goo Dolls', year: '1998', label: 'Warner Records',
      art: 'assets/covers/edify/iris.jpg', focus: '45% 85%',
    },
    {
      song: 'Dream On', spotify: '1xsYj84j7hUDDnTTerGWlH', title: 'Aerosmith', artist: 'Aerosmith', year: '1973', label: 'Columbia',
      art: 'assets/covers/edify/dream-on.jpg', focus: '50% 0%',
    },
    {
      song: 'Red Swan', spotify: '0zvN9oq95bIEQjvfcdeZlX', title: 'Red Swan', artist: 'YOSHIKI feat. HYDE', year: '2018', label: 'Pony Canyon',
      art: 'assets/covers/edify/red-swan.jpg', artCredit: '“Attack on Titan” The Final Season Original Soundtrack (music by Kohta Yamamoto / Hiroyuki Sawano)', focus: '50% 30%',
    },
    {
      song: 'Stand By Me', spotify: '3SdTKo2uVsxFblQjpScoHy', title: 'Don’t Play That Song', artist: 'Ben E. King', year: '1962', label: 'Atco / Rhino',
      art: 'assets/covers/edify/stand-by-me.jpg', artCredit: 'Ben E. King, Stand By Me (Hammonia Phono Archive)', focus: '95% 20%',
    },
  ],
};
