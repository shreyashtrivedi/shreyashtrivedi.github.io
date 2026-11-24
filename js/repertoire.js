// The pieces a visitor can choose from. Note data for each lives in js/music/<id>.js
// and is loaded only when the piece is chosen. The menu groups pieces by mood.
//
// speed   playback rate relative to the file's notated tempo (to reach a natural performance tempo)
// level   overall loudness, 0–1 (most source files carry no dynamics, so this sets the character)
// accents make chords of three or more notes sforzando
// roll    spread large chords slightly from the bottom up, as romantic pianists do
// length  playing time shown in the list (update it if you change speed)
// light   the stage lighting while it plays: golden, candle, dawn, moonlit, crimson
//         (defaults: joyful pieces golden, calm ones candlelit, dramatic ones moonlit)
//
// Bollywood: add entries with category 'Bollywood' (and mood 'Bollywood') once you have note
// data you are allowed to publish, for example your own arrangement with a cover licence for the
// song. Film songs are still under copyright, so they can't be taken from the internet like the
// public-domain works below.
(() => {
  const M = (id) => `https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=${id}`;
  const JOY = 'Bright & joyful';
  const CALM = 'Calm & lyrical';
  const DRAMA = 'Dramatic';
  const W = 'Western classical';

  window.REPERTOIRE = [
    // Bright & joyful
    { id: 'entertainer', length: '3:24', mood: JOY, title: 'The Entertainer', part: 'A ragtime two-step', composer: 'Scott Joplin', year: '1902', speed: 1.25, level: 0.44, licence: 'Public domain', source: M(263) },
    { id: 'allaturca', length: '2:03', mood: JOY, title: 'Rondo alla Turca', part: 'Sonata K. 331, III', composer: 'Wolfgang Amadeus Mozart', year: '1783', speed: 2.1, level: 0.42, licence: 'Public domain', source: M(108) },
    { id: 'mapleleaf', length: '2:33', mood: JOY, title: 'Maple Leaf Rag', part: 'Tempo di marcia', composer: 'Scott Joplin', year: '1899', speed: 0.95, level: 0.44, licence: 'Public domain', source: M(23) },
    { id: 'troldhaugen', length: '6:10', mood: JOY, title: 'Wedding Day at Troldhaugen', part: 'Lyric Pieces, Op. 65 No. 6', composer: 'Edvard Grieg', year: '1896', speed: 1, level: 0.42, roll: true, licence: 'Public domain', source: M(781) },
    { id: 'arabesque1', length: '4:00', mood: JOY, light: 'dawn', title: 'Arabesque No. 1', part: 'L. 66 No. 1', composer: 'Claude Debussy', year: '1891', speed: 0.75, level: 0.36, licence: 'Public domain', source: M(1777) },
    { id: 'k545', length: '2:14', mood: JOY, title: 'Sonata in C major', part: 'K. 545, I. Allegro', composer: 'Wolfgang Amadeus Mozart', year: '1788', speed: 1, level: 0.38, licence: 'CC BY-SA 3.0', source: M(998) },
    { id: 'pineapple', length: '2:58', mood: JOY, title: 'Pineapple Rag', part: 'Ragtime two-step', composer: 'Scott Joplin', year: '1908', speed: 1, level: 0.44, licence: 'Public domain', source: M(1899) },
    { id: 'minutewaltz', length: '1:51', mood: JOY, title: 'Minute Waltz', part: 'Op. 64 No. 1', composer: 'Frédéric Chopin', year: '1847', speed: 0.82, level: 0.38, licence: 'Public domain', source: M(483) },
    { id: 'haydnallegro', length: '2:24', mood: JOY, title: 'Sonata in G major', part: 'Hob. XVI:27, I. Allegro con brio', composer: 'Joseph Haydn', year: '1776', speed: 1, level: 0.4, licence: 'Public domain', source: M(185) },
    { id: 'arabesque2', length: '3:42', mood: JOY, light: 'dawn', title: 'Arabesque No. 2', part: 'L. 66 No. 2', composer: 'Claude Debussy', year: '1891', speed: 1, level: 0.4, licence: 'CC BY-SA 4.0', source: M(1994) },
    { id: 'elite', length: '3:12', mood: JOY, title: 'Elite Syncopations', part: 'Ragtime', composer: 'Scott Joplin', year: '1902', speed: 1.55, level: 0.44, licence: 'Public domain', source: M(1540) },
    { id: 'clementi', length: '0:46', mood: JOY, title: 'Sonatina in C major', part: 'Op. 36 No. 1, I. Allegro', composer: 'Muzio Clementi', year: '1797', speed: 1.15, level: 0.42, licence: 'Public domain', source: M(804) },
    { id: 'invention8', length: '1:08', mood: JOY, title: 'Invention No. 8 in F major', part: 'BWV 779', composer: 'Johann Sebastian Bach', year: '1723', speed: 1, level: 0.42, licence: 'Public domain', source: M(61) },
    { id: 'styrienne', length: '0:38', mood: JOY, title: 'La Styrienne', part: '25 Études faciles, Op. 100 No. 14', composer: 'Friedrich Burgmüller', year: '1851', speed: 1, level: 0.42, licence: 'Public domain', source: M(225) },
    { id: 'burgarabesque', length: '0:27', mood: JOY, title: 'L’Arabesque', part: '25 Études faciles, Op. 100 No. 2', composer: 'Friedrich Burgmüller', year: '1851', speed: 1, level: 0.42, licence: 'Public domain', source: M(203) },

    // Calm & lyrical
    { id: 'clairdelune', length: '5:13', mood: CALM, light: 'moonlit', title: 'Clair de lune', part: 'Suite bergamasque', composer: 'Claude Debussy', year: '1905', speed: 1.05, level: 0.32, roll: true, licence: 'Public domain', source: M(1778) },
    { id: 'nocturne', length: '4:04', mood: CALM, title: 'Nocturne in E-flat major', part: 'Op. 9 No. 2', composer: 'Frédéric Chopin', year: '1832', speed: 0.85, level: 0.36, roll: true, licence: 'CC BY-SA 3.0', source: M(1590) },
    { id: 'furelise', length: '2:02', mood: CALM, title: 'Für Elise', part: 'Bagatelle, WoO 59', composer: 'Ludwig van Beethoven', year: '1810', speed: 1.1, level: 0.38, licence: 'Public domain', source: M(931) },
    { id: 'moonlight1', length: '5:14', mood: CALM, light: 'moonlit', title: 'Moonlight Sonata', part: 'I. Adagio sostenuto', composer: 'Ludwig van Beethoven', year: '1801', speed: 0.9, level: 0.3, licence: 'CC BY-SA 2.5', source: M(276) },
    { id: 'gnossienne', length: '3:43', mood: CALM, light: 'moonlit', title: 'Gnossienne No. 1', part: 'Lent', composer: 'Erik Satie', year: '1890', speed: 0.9, level: 0.32, licence: 'CC BY-SA 4.0', source: M(2035) },

    // Dramatic
    { id: 'moonlight3', length: '5:18', mood: DRAMA, title: 'Moonlight Sonata', part: 'III. Presto agitato', composer: 'Ludwig van Beethoven', year: '1801', speed: 152 / 60, level: 0.4, accents: true, licence: 'CC BY-SA 2.5', source: M(276) },
    { id: 'mountainking', length: '2:26', mood: DRAMA, light: 'crimson', title: 'In the Hall of the Mountain King', part: 'Peer Gynt, Op. 46 No. 4', composer: 'Edvard Grieg', year: '1875', speed: 1, level: 0.4, licence: 'Public domain', source: M(1888) },
  ].map((p) => ({ category: W, length: '', light: { [JOY]: 'golden', [CALM]: 'candle', [DRAMA]: 'moonlit' }[p.mood], ...p }));
})();
