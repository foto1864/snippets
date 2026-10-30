// Hands files dropped on the home page over to the tool the user picks.
import { detectKind } from './files';

let pending = [];

export function setPendingFiles(files) {
  pending = files;
}

/** Returns (and clears) pending files that the tool can accept. */
export function takePendingFiles(kinds) {
  const files = pending.filter((f) => kinds.includes(detectKind(f)));
  // Cleared asynchronously so StrictMode's double-invoked initializers both see the files.
  setTimeout(() => {
    pending = [];
  }, 0);
  return files;
}
