/** Flat app background. The old blurred-blob + noise layers are gone
 *  (CompQsoft Console redesign): `body` already paints `var(--bg)`, so
 *  this renders nothing. The component and its import contract are kept
 *  so `layout.tsx` and any other consumers keep working unchanged. */
export function GlassBackground() {
	return null;
}
