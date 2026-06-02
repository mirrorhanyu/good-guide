// Shared hand sprite coordinates. The artwork is the premium CapCut cartoon
// pointing hand (loaded as public/hand.png, 280x280px with transparent background).
// Natively, the index finger points up-left (tilted by about -30 degrees).

export const HAND_VIEWBOX = { w: 280, h: 280 };

// Fingertip apex (anchor / rotation pivot) coordinates in 280x280 space.
export const HAND_ANCHOR = { x: 86 / 280, y: 47 / 280 };

// Drawn content extents in 280x280 space, for selection bounds.
export const HAND_BBOX = { minx: 69, miny: 47, maxx: 247, maxy: 259 };



