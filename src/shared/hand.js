// Shared hand sprite. The artwork is a flat single-colour "pointing" icon
// (provided as SVG). We rotate it -90° so the index finger points UP, recolour
// it by swapping the single fill, and rasterise it: the browser loads it as an
// Image via a data URI (preview), and Node loads the same markup as a Buffer
// via @napi-rs/canvas (export) — so both runtimes render identically.

export const HAND_VIEWBOX = { w: 32, h: 32 };

// Fingertip apex (anchor / rotation pivot) in the upright viewBox, as a ratio.
export const HAND_ANCHOR = { x: 12.97 / 32, y: 0 / 32 };

// Drawn content extents (upright) in viewBox units, for selection bounds.
export const HAND_BBOX = { minx: 6.6, miny: 0, maxx: 28.35, maxy: 31.95 };

// Original right-pointing path from the supplied SVG (viewBox 0 0 32).
const HAND_PATH =
  "M29,10H19c0-1.654-1.346-3-3-3h-5c-0.656,0-1.301,0.219-1.821,0.617L3.716,11H1" +
  "c-0.552,0-1,0.448-1,1v12c0,0.552,0.448,1,1,1h2.687l2.972,2.069C7.247,27.613,8.214,28,9,28h9.848c1.582,0,3.006-1.16,3.141-2.737" +
  "c0.054-0.633-0.089-1.229-0.375-1.735C22.446,22.995,23,22.061,23,21c0-0.535-0.141-1.037-0.387-1.472" +
  "C23.446,18.995,24,18.061,24,17c0-0.351-0.061-0.687-0.171-1H29c1.657,0,3-1.343,3-3S30.657,10,29,10z M4,23H2V13h2V23z M29,14h-8" +
  "c-0.552,0-1,0.448-1,1c0,0.552,0.448,1,1,1c0.552,0,1,0.449,1,1s-0.448,1-1,1h-1c-0.552,0-1,0.448-1,1c0,0.552,0.448,1,1,1" +
  "c0.552,0,1,0.449,1,1s-0.448,1-1,1h-1c-0.552,0-1,0.448-1,1c0,0.552,0.448,1,1,1c0.552,0,1,0.449,1,1s-0.448,1-1,1H9" +
  "c-0.285,0-0.799-0.213-1-0.414l-3-2.104V12.557l5.277-3.268C10.277,9.289,10.774,9,11,9h5c0.552,0,1,0.449,1,1c0,0.168,0,1,0,1h-4" +
  "c-0.276,0-0.5,0.224-0.5,0.5c0,0.276,0.224,0.5,0.5,0.5h16c0.552,0,1,0.448,1,1C30,13.552,29.552,14,29,14z";

// Rasterise at this pixel size so up-scaling onto the canvas stays crisp.
const RASTER = 1024;

/** Build the upright, recoloured hand SVG markup. */
export function buildHandSVG(fill = "#1b1b1f") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${RASTER}" height="${RASTER}" viewBox="0 0 32 32">` +
    `<g transform="rotate(-90 16 16)"><path d="${HAND_PATH}" fill="${fill}"/></g></svg>`;
}

/** data: URI form, loadable as an Image in the browser. */
export function buildHandDataURI(fill) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(buildHandSVG(fill));
}
