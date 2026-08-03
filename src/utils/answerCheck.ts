import type { CustomTrack, HitsterCategory, Language } from '../types/hitster';

/**
 * Nakijken van een antwoord tegen het nummer dat speelde.
 *
 * Het bordspel laat spelers zelf beoordelen met de kaart erbij; hier is de
 * Spotify-metadata al bekend, dus dat kan automatisch. Bij tekstantwoorden
 * moet dat wel tolerant: mensen typen "Dont Stop Me Now" of "the beatles",
 * en het bordspel accepteert spellingsvarianten ook zolang het ondubbelzinnig is.
 */

export interface AnswerVerdict {
  correct: boolean;
  /** Uitleg voor de speler, in de gekozen taal */
  message: string;
  /** Het juiste antwoord, om na afloop te tonen */
  actual: string;
  /** Antwoord kon niet automatisch worden beoordeeld — spelers doen het zelf */
  needsManualCheck?: boolean;
}

/** Kleinletters, accentloos, zonder leestekens en losse "the" ervoor. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Alles tussen haakjes weg: "(Remastered 2011)", "(feat. X)"
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    // Spotify hangt varianten achter een streepje: "- 2011 Remaster"
    .replace(/\s-\s.*$/, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/^the\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = [...curr];
  }
  return prev[b.length];
}

/**
 * Tolerant vergelijken: gelijk na normalisatie, of één partij bevat de andere
 * (handig bij "Queen" vs "Queen, David Bowie"), of een paar tikfouten ernaast.
 */
function looseMatch(guess: string, actual: string): boolean {
  const g = normalise(guess);
  const a = normalise(actual);
  if (!g || !a) return false;
  if (g === a) return true;

  // Meerdere artiesten: één goed geraden naam volstaat
  const actualParts = a.split(/\s*,\s*|\s+and\s+/).map(s => s.trim()).filter(Boolean);
  if (actualParts.some(p => p === g)) return true;

  if (a.includes(g) && g.length >= 4) return true;
  if (g.includes(a) && a.length >= 4) return true;

  // Ruimere marge voor langere titels, maar nooit meer dan een kwart eraf
  const budget = Math.min(3, Math.floor(Math.max(g.length, a.length) / 4));
  return levenshtein(g, a) <= budget;
}

export function checkAnswer(
  rawAnswer: string,
  category: HitsterCategory,
  track: CustomTrack,
  language: Language = 'nl'
): AnswerVerdict {
  const isNl = language === 'nl';
  const answer = rawAnswer.trim();

  if (!answer) {
    return {
      correct: false,
      message: isNl ? 'Geen antwoord ingevuld.' : 'No answer given.',
      actual: '—',
    };
  }

  switch (category.answerType) {
    case 'year': {
      const guess = parseInt(answer, 10);
      const actual = track.year;
      if (!actual) {
        return {
          correct: false,
          needsManualCheck: true,
          message: isNl
            ? 'Van dit nummer is geen jaartal bekend — beoordeel zelf.'
            : 'No release year known for this track — decide together.',
          actual: isNl ? 'onbekend' : 'unknown',
        };
      }
      if (isNaN(guess)) {
        return {
          correct: false,
          message: isNl ? 'Vul een jaartal in.' : 'Enter a year.',
          actual: String(actual),
        };
      }

      const diff = Math.abs(guess - actual);
      const tolerance = category.tolerance ?? 0;
      const correct = diff <= tolerance;

      let message: string;
      if (correct && diff === 0) {
        message = isNl ? `🏆 Precies goed: ${actual}!` : `🏆 Spot on: ${actual}!`;
      } else if (correct) {
        message = isNl
          ? `✅ Goed! Het was ${actual}, je zat er ${diff} jaar naast (mag tot ${tolerance}).`
          : `✅ Correct! It was ${actual}, off by ${diff} (allowed: ${tolerance}).`;
      } else {
        message = isNl
          ? `❌ Het was ${actual}. Je zat er ${diff} jaar naast (mocht tot ${tolerance}).`
          : `❌ It was ${actual}. Off by ${diff} (allowed: ${tolerance}).`;
      }
      return { correct, message, actual: String(actual) };
    }

    case 'decade': {
      const actual = track.year;
      if (!actual) {
        return {
          correct: false,
          needsManualCheck: true,
          message: isNl ? 'Geen jaartal bekend — beoordeel zelf.' : 'No year known — decide together.',
          actual: isNl ? 'onbekend' : 'unknown',
        };
      }
      // "80", "80s", "1980" en "jaren 80" moeten allemaal werken
      const digits = answer.replace(/\D/g, '');
      let guessDecade: number | null = null;
      if (digits.length === 4) guessDecade = Math.floor(parseInt(digits, 10) / 10) * 10;
      else if (digits.length === 2) {
        const n = parseInt(digits, 10);
        guessDecade = n >= 30 ? 1900 + n : 2000 + n;
      }

      const actualDecade = Math.floor(actual / 10) * 10;
      const label = `${actualDecade}s`;

      if (guessDecade === null) {
        return {
          correct: false,
          message: isNl ? `❌ Onduidelijk antwoord. Het was de ${label}.` : `❌ Unclear. It was the ${label}.`,
          actual: label,
        };
      }

      const correct = guessDecade === actualDecade;
      return {
        correct,
        message: correct
          ? (isNl ? `✅ Goed! De ${label} (${actual}).` : `✅ Correct! The ${label} (${actual}).`)
          : (isNl ? `❌ Het was de ${label} (${actual}).` : `❌ It was the ${label} (${actual}).`),
        actual: label,
      };
    }

    case 'beforeAfter': {
      const actual = track.year;
      const pivot = category.pivotYear ?? 2000;
      if (!actual) {
        return {
          correct: false,
          needsManualCheck: true,
          message: isNl ? 'Geen jaartal bekend — beoordeel zelf.' : 'No year known — decide together.',
          actual: isNl ? 'onbekend' : 'unknown',
        };
      }

      const actualIsBefore = actual < pivot;
      const a = normalise(answer);
      const saysBefore = /(voor|vóór|before|<)/.test(a);
      const saysAfter = /(na|naar|after|vanaf|>)/.test(a);

      if (!saysBefore && !saysAfter) {
        return {
          correct: false,
          message: isNl
            ? `❌ Kies "vóór" of "ná". Het was ${actual}.`
            : `❌ Choose "before" or "after". It was ${actual}.`,
          actual: actualIsBefore ? `vóór ${pivot}` : `vanaf ${pivot}`,
        };
      }

      const guessIsBefore = saysBefore && !saysAfter;
      const correct = guessIsBefore === actualIsBefore;
      const actualLabel = actualIsBefore
        ? (isNl ? `vóór ${pivot}` : `before ${pivot}`)
        : (isNl ? `vanaf ${pivot}` : `from ${pivot}`);

      return {
        correct,
        message: correct
          ? (isNl ? `✅ Goed! ${actual} is ${actualLabel}.` : `✅ Correct! ${actual} is ${actualLabel}.`)
          : (isNl ? `❌ Mis. Het was ${actual}, dus ${actualLabel}.` : `❌ Wrong. It was ${actual}, so ${actualLabel}.`),
        actual: actualLabel,
      };
    }

    case 'soloGroup': {
      const a = normalise(answer);
      const saysSolo = /(solo|persoon|person|single|een artiest)/.test(a);
      const saysGroup = /(groep|group|band|duo|samen|meerdere)/.test(a);

      // MusicBrainz weet dit; Spotify niet. Zonder die verrijking beslissen
      // de spelers zelf, net als bij het bordspel.
      if (!track.artistType || track.artistType === 'unknown') {
        return {
          correct: false,
          needsManualCheck: true,
          message: isNl
            ? `Niet automatisch te bepalen voor "${track.artist}" — beoordeel samen.`
            : `Can't verify automatically for "${track.artist}" — decide together.`,
          actual: track.artist,
        };
      }

      if (!saysSolo && !saysGroup) {
        return {
          correct: false,
          message: isNl ? 'Kies "solo" of "groep".' : 'Choose "solo" or "group".',
          actual: track.artistType === 'person' ? 'solo' : 'groep',
        };
      }

      const guessIsSolo = saysSolo && !saysGroup;
      const actualIsSolo = track.artistType === 'person';
      const correct = guessIsSolo === actualIsSolo;
      const actualLabel = actualIsSolo
        ? (isNl ? 'solo-artiest' : 'solo artist')
        : (isNl ? 'groep/band' : 'group/band');

      return {
        correct,
        message: correct
          ? (isNl ? `✅ Goed! ${track.artist} is een ${actualLabel}.` : `✅ Correct! ${track.artist} is a ${actualLabel}.`)
          : (isNl ? `❌ Mis. ${track.artist} is een ${actualLabel}.` : `❌ Wrong. ${track.artist} is a ${actualLabel}.`),
        actual: actualLabel,
      };
    }

    case 'title': {
      const correct = looseMatch(answer, track.title);
      return {
        correct,
        message: correct
          ? (isNl ? `✅ Goed! "${track.title}".` : `✅ Correct! "${track.title}".`)
          : (isNl ? `❌ Het was "${track.title}".` : `❌ It was "${track.title}".`),
        actual: track.title,
      };
    }

    case 'artist': {
      const correct = looseMatch(answer, track.artist);
      return {
        correct,
        message: correct
          ? (isNl ? `✅ Goed! ${track.artist}.` : `✅ Correct! ${track.artist}.`)
          : (isNl ? `❌ Het was ${track.artist}.` : `❌ It was ${track.artist}.`),
        actual: track.artist,
      };
    }
  }
}
