import { pathToFileURL } from 'node:url';

export function isConventionalTitle(title) {
  return (
    typeof title === 'string' &&
    title.length <= 72 &&
    /^(feat|fix|docs|test|chore|ci|refactor|perf|build|revert)\([a-z][a-z0-9-]*\)!?: \S[^\r\n]*$/u.test(
      title,
    )
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!isConventionalTitle(process.env.PR_TITLE)) {
    console.error('Titre attendu : type(zone): description, sur une ligne, 72 caractères maximum.');
    if (typeof process.env.PR_TITLE === 'string' && process.env.PR_TITLE.length > 72) {
      console.error(
        `Longueur actuelle : ${process.env.PR_TITLE.length} caractères. Raccourcir le titre de la PR dans GitHub avant fusion, y compris pour Dependabot.`,
      );
    }
    process.exitCode = 1;
  } else {
    console.info('Titre de PR conforme.');
  }
}
