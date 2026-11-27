const MAX_ARENA_CHAT_DIMENSION = 4_096;
const MAX_ARENA_CHAT_COORDINATE = 16_384;

export function clampArenaChatBounds(bounds, contentBounds, { allowHidden = false } = {}) {
  if (!bounds || typeof bounds !== 'object' || (bounds.visible !== true && !allowHidden)) return null;

  const values = [bounds.x, bounds.y, bounds.width, bounds.height];
  if (!values.every((value) => typeof value === 'number' && Number.isFinite(value))) return null;

  const contentWidth = Math.floor(contentBounds?.width);
  const contentHeight = Math.floor(contentBounds?.height);
  if (!Number.isFinite(contentWidth) || !Number.isFinite(contentHeight) || contentWidth < 1 || contentHeight < 1) return null;

  const x = Math.round(bounds.x);
  const y = Math.round(bounds.y);
  const width = Math.round(bounds.width);
  const height = Math.round(bounds.height);
  if (width < 1 || height < 1
    || width > MAX_ARENA_CHAT_DIMENSION || height > MAX_ARENA_CHAT_DIMENSION
    || Math.abs(x) > MAX_ARENA_CHAT_COORDINATE || Math.abs(y) > MAX_ARENA_CHAT_COORDINATE) return null;

  const intersectsContent = x < contentWidth && x + width > 0 && y < contentHeight && y + height > 0;
  if (!allowHidden && !intersectsContent) return null;

  // Preserve the DOM frame's complete dimensions while it is partly outside the
  // window. Electron clips the child view at the window edge; shrinking it here
  // would reflow Arena while the surrounding page scrolls.
  return { x, y, width, height };
}
