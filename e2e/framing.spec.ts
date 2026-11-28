import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

for (const sameOrigin of [true, false]) {
  test(`leaves the app unmounted in a ${sameOrigin ? 'same' : 'cross'}-origin frame`, async ({ page, baseURL }) => {
    await page.route(/^https:\/\//, route => route.abort());
    const html = `<iframe src="${baseURL}"></iframe>`;
    const host = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });
    try {
      if (sameOrigin) {
        await page.route('**/frame-test', route => route.fulfill({ contentType: 'text/html', body: html }));
        await page.goto('/frame-test');
      } else {
        await new Promise<void>(resolve => host.listen(0, '127.0.0.1', resolve));
        await page.goto(`http://127.0.0.1:${(host.address() as AddressInfo).port}`);
      }
      await expect(page.frameLocator('iframe').locator('#root')).toBeEmpty();
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    } finally {
      if (host.listening) host.close();
    }
  });
}
