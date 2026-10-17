import { test, expect } from '@playwright/test';

// Observe real browser Web Audio objects; no production diagnostics or fake audio engine.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const contexts: AudioContext[] = [];
    const activity = { starts: 0, cancellations: 0 };
    const NativeContext = window.AudioContext;
    class ObservedContext extends NativeContext {
      constructor(options?: AudioContextOptions) { super(options); contexts.push(this); }
      override createOscillator() {
        const oscillator = super.createOscillator();
        const start = oscillator.start.bind(oscillator);
        const stop = oscillator.stop.bind(oscillator);
        oscillator.start = (when?: number) => { activity.starts++; start(when); };
        oscillator.stop = (when?: number) => {
          if (when === undefined) activity.cancellations++;
          stop(when);
        };
        return oscillator;
      }
    }
    window.AudioContext = ObservedContext;
    Object.assign(window, { audioProbe: { contexts, activity } });
  });
});

async function states(page: import('@playwright/test').Page) {
  return page.evaluate(() => (window as any).audioProbe.contexts.map((c: AudioContext) => c.state));
}

test('手机音效按需创建，模拟原生后台事件暂停后由继续按钮恢复', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#start')).toBeEnabled();
  expect(await states(page)).toEqual([]);
  await page.locator('#sound').click();
  await expect.poll(() => states(page)).toEqual(['running']);
  await expect.poll(() => page.evaluate(() => (window as any).audioProbe.activity.starts)).toBeGreaterThan(0);
  await page.locator('#start').click();
  await expect(page.locator('#live-table')).toHaveAttribute('data-busy', 'false');
  await page.evaluate(() => window.dispatchEvent(new Event('wendao:suspend')));
  await expect(page.locator('#resume')).toBeVisible();
  await expect.poll(() => states(page)).toEqual(['suspended']);
  await page.locator('#resume').click();
  await expect.poll(() => states(page)).toEqual(['running']);
  await page.locator('#sound').click();
  await expect.poll(() => states(page)).toEqual(['suspended']);
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('真实音频上下文停止待播和弦，销毁后关闭资源且不重建', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#start')).toBeEnabled();
  await page.evaluate(async () => {
    const modulePath = '/src/audio.ts';
    const { AudioFeedback } = await import(/* @vite-ignore */ modulePath);
    const feedback = new AudioFeedback();
    Object.assign(window, { audioFixture: feedback });
    const button = document.createElement('button');
    button.id = 'audio-fixture'; button.textContent = '音频生命周期测试';
    button.style.cssText = 'position:fixed;top:0;left:0;z-index:99999';
    button.onclick = async () => {
      feedback.enabled = true;
      await feedback.preview('win');
      feedback.enabled = false;
      button.dataset.phase = 'muted';
    };
    document.body.append(button);
  });
  await page.locator('#audio-fixture').click();
  await expect(page.locator('#audio-fixture')).toHaveAttribute('data-phase', 'muted');
  await expect.poll(() => states(page)).toEqual(['suspended']);
  expect(await page.evaluate(() => (window as any).audioProbe.activity)).toEqual({ starts: 3, cancellations: 3 });
  await page.evaluate(() => {
    (document.querySelector('#audio-fixture') as HTMLButtonElement).onclick = async () => {
      const feedback = (window as any).audioFixture;
      feedback.enabled = true;
      const pending = feedback.preview('card');
      feedback.enabled = false;
      await pending;
      (document.querySelector('#audio-fixture') as HTMLElement).dataset.phase = 'cancelled';
    };
  });
  await page.locator('#audio-fixture').click();
  await expect(page.locator('#audio-fixture')).toHaveAttribute('data-phase', 'cancelled');
  await expect.poll(() => states(page)).toEqual(['suspended']);
  expect(await page.evaluate(() => (window as any).audioProbe.activity.starts)).toBe(3);
  await page.evaluate(() => {
    (document.querySelector('#audio-fixture') as HTMLButtonElement).onclick = async () => {
      const feedback = (window as any).audioFixture;
      feedback.enabled = true;
      await feedback.preview('card');
      feedback.enabled = false;
      (document.querySelector('#audio-fixture') as HTMLElement).dataset.phase = 'reopened';
    };
  });
  await page.locator('#audio-fixture').click();
  await expect(page.locator('#audio-fixture')).toHaveAttribute('data-phase', 'reopened');
  await expect.poll(() => states(page)).toEqual(['suspended']);
  expect(await page.evaluate(() => (window as any).audioProbe.activity.starts)).toBe(4);
  await page.evaluate(() => {
    const feedback = (window as any).audioFixture;
    feedback.dispose(); feedback.dispose();
    feedback.enabled = true;
    void feedback.preview('card');
  });
  await expect.poll(() => states(page)).toEqual(['closed']);
  expect(await page.evaluate(() => (window as any).audioProbe.activity.starts)).toBe(4);
});
