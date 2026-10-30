import ImageTracer from 'imagetracerjs';

self.onmessage = ({ data }) => {
  const { id, imageData, options } = data;
  try {
    const svg = ImageTracer.imagedataToSVG(imageData, options);
    self.postMessage({ id, svg });
  } catch (err) {
    self.postMessage({ id, error: err?.message || String(err) });
  }
};
