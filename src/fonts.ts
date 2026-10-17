export const tableSerif = '"Wendao Serif", "Songti SC", "STSong", serif';

export async function prepareFonts() {
  if (!document.fonts) return;
  // Canvas textures are rasterized once. Resolve the local font before drawing their text.
  // A failed font download must still allow practice with the system fallback.
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    document.fonts.load('400 16px "Wendao Serif"').catch(() => []),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, 1500);
    }),
  ]);
  clearTimeout(timer);
}
