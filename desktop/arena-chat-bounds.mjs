export function clampArenaChatBounds(bounds, contentBounds, { allowHidden = false } = {}) {
  if (!bounds || typeof bounds !== 'object' || (bounds.visible !== true && !allowHidden)) return null;

  const values = [bounds.x, bounds.y, bounds.width, bounds.height];
  if (!values.every((value) => typeof value === 'number' && Number.isFinite(value))) return null;

  const contentWidth = Math.floor(contentBounds?.width);
  const contentHeight = Math.floor(contentBounds?.height);
  if (!Number.isFinite(contentWidth) || !Number.isFinite(contentHeight) || contentWidth < 1 || contentHeight < 1) return null;

  const rawLeft = Math.round(bounds.x);
  const rawTop = Math.round(bounds.y);
  const rawRight = Math.round(bounds.x + bounds.width);
  const rawBottom = Math.round(bounds.y + bounds.height);
  if (!Number.isFinite(rawRight) || !Number.isFinite(rawBottom)) return null;

  const x = Math.max(0, Math.min(contentWidth, rawLeft));
  const y = Math.max(0, Math.min(contentHeight, rawTop));
  const right = Math.max(0, Math.min(contentWidth, rawRight));
  const bottom = Math.max(0, Math.min(contentHeight, rawBottom));
  const width = right - x;
  const height = bottom - y;
  if (width < 1 || height < 1) return null;

  return { x, y, width, height };
}
