import { uniqueNames } from './files';

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Zips outputs ({ name, blob }) and downloads the archive. */
export async function downloadZip(outputs, zipName = 'converted.zip') {
  const { zip } = await import('fflate');
  const names = uniqueNames(outputs.map((o) => o.name));
  const entries = {};
  await Promise.all(
    outputs.map(async (o, i) => {
      // Images and PDFs are already compressed; storing them is much faster.
      entries[names[i]] = [new Uint8Array(await o.blob.arrayBuffer()), { level: 0 }];
    }),
  );
  const data = await new Promise((resolve, reject) =>
    zip(entries, (err, out) => (err ? reject(err) : resolve(out))),
  );
  downloadBlob(new Blob([data], { type: 'application/zip' }), zipName);
}

export function canShareFiles(outputs) {
  try {
    const files = outputs.map((o) => new File([o.blob], o.name, { type: o.blob.type }));
    return !!navigator.canShare?.({ files });
  } catch {
    return false;
  }
}

export async function shareFiles(outputs) {
  const files = outputs.map((o) => new File([o.blob], o.name, { type: o.blob.type }));
  try {
    await navigator.share({ files });
  } catch (err) {
    if (err?.name !== 'AbortError') throw err;
  }
}
