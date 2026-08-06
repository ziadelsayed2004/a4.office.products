const FONT_WAIT_TIMEOUT_MS = 4_000;
const IMAGE_WAIT_TIMEOUT_MS = 6_000;

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function waitWithin(promise, milliseconds) {
  await Promise.race([Promise.resolve(promise).catch(() => undefined), delay(milliseconds)]);
}

export async function waitForPrintableAssets(container) {
  if (document.fonts?.ready) {
    await waitWithin(document.fonts.ready, FONT_WAIT_TIMEOUT_MS);
  }

  const images = Array.from(container?.querySelectorAll('img') || []);
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await waitWithin(
          new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
          }),
          IMAGE_WAIT_TIMEOUT_MS
        );
      }
      if (image.decode) {
        await waitWithin(image.decode(), IMAGE_WAIT_TIMEOUT_MS);
      }
    })
  );

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
