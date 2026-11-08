import { test, expect } from '@playwright/test';
import { rigDeck } from './helpers.js';

// Sala online con DOS navegadores independientes (cada uno con su localStorage,
// como dos dispositivos). Verifica el reloj de turno que pinta la UI:
// 15–10 s verde, 9–5 amarillo, < 5 rojo, y que cada carta sacada lo reinicia.
test('Online: el reloj cambia de color y se reinicia al sacar una carta', async ({ browser }) => {
  test.setTimeout(90_000);
  const opts = { baseURL: 'http://localhost:5174', reducedMotion: 'reduce' };
  const hostCtx = await browser.newContext(opts);
  const guestCtx = await browser.newContext(opts);
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  // Ana abre la sala.
  await host.goto('/setup?modo=online');
  await host.getByRole('tab', { name: 'Crear sala' }).click();
  await host.getByPlaceholder('Ana').fill('Ana');
  await host.locator('form button[type="submit"]').click();
  await host.waitForURL(/\/setup\?game=/);
  // El lobby muestra "······" hasta que llega el estado: se espera al código real.
  await expect(host.locator('.room-code')).toHaveText(/^[A-Z2-9]{6}$/);
  const code = (await host.locator('.room-code').textContent()).trim();

  // Beto entra con el código desde "otro dispositivo".
  await guest.goto(`/setup?code=${code}`);
  await guest.getByPlaceholder('Ana').fill('Beto');
  await guest.getByPlaceholder('ABC234').fill(code);
  await guest.locator('form button[type="submit"]').click();
  await guest.waitForURL(/\/setup\?game=/);

  // El host empieza (el botón se habilita cuando el lobby ve 2 jugadores).
  await host.getByRole('button', { name: 'Empezar partida' }).click();
  await host.waitForURL(/\/game\//);
  await guest.waitForURL(/\/game\//); // el lobby del invitado salta solo al tablero

  const timer = host.getByRole('timer');
  await expect(timer).toHaveClass(/timer-green/);
  await expect(host.getByRole('button', { name: 'Plantarse' })).toBeDisabled();

  // Pasan ~6 s sin actuar → amarillo.
  await expect(timer).toHaveClass(/timer-yellow/, { timeout: 12_000 });

  // Sacar una carta reinicia los 15 s → vuelve a verde y ya puede plantarse.
  await host.getByRole('button', { name: 'Pedir' }).click();
  await expect(timer).toHaveClass(/timer-green/);
  await expect(host.getByRole('button', { name: 'Plantarse' })).toBeEnabled();

  // Sin actuar, llega a rojo (menos de 5 s).
  await expect(timer).toHaveClass(/timer-red/, { timeout: 16_000 });

  // El invitado ve el mismo turno: no es el suyo, sus botones están deshabilitados.
  await expect(guest.getByRole('button', { name: 'Pedir' })).toBeDisabled();

  await hostCtx.close();
  await guestCtx.close();
});

// Lo que hace un jugador lo ven los demás: el aviso sobre su cabeza ("Pidió")
// y, si repite, la animación de pérdida con la carta repetida.
test('Online: el otro jugador ve las decisiones y la carta con la que se perdió', async ({ browser, request }) => {
  test.setTimeout(90_000);
  const opts = { baseURL: 'http://localhost:5174', reducedMotion: 'reduce' };
  const hostCtx = await browser.newContext(opts);
  const guestCtx = await browser.newContext(opts);
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  await host.goto('/setup?modo=online');
  await host.getByRole('tab', { name: 'Crear sala' }).click();
  await host.getByPlaceholder('Ana').fill('Ana');
  await host.locator('form button[type="submit"]').click();
  await host.waitForURL(/\/setup\?game=/);
  await expect(host.locator('.room-code')).toHaveText(/^[A-Z2-9]{6}$/);
  const code = (await host.locator('.room-code').textContent()).trim();
  await guest.goto(`/setup?code=${code}`);
  await guest.getByPlaceholder('Ana').fill('Beto');
  await guest.getByPlaceholder('ABC234').fill(code);
  await guest.locator('form button[type="submit"]').click();
  await guest.waitForURL(/\/setup\?game=/);
  await host.getByRole('button', { name: 'Empezar partida' }).click();
  await host.waitForURL(/\/game\//);
  await guest.waitForURL(/\/game\//);
  const gameId = host.url().split('/').pop();
  await rigDeck(request, gameId, [3, 4, 3, 8]);

  // Ana pide: Beto ve "Pidió" sobre la chapa de Ana (llega por el sondeo).
  await host.getByRole('button', { name: 'Pedir' }).click();
  const anaSeat = guest.locator('.seat-panel').filter({ has: guest.locator('h2', { hasText: 'Ana' }) });
  await expect(anaSeat.locator('.act-badge')).toContainText('Pidió', { timeout: 6_000 });

  // Ana saca 4 y repite el 3: Beto ve la pérdida y con qué carta.
  await host.getByRole('button', { name: 'Pedir' }).click();
  await host.getByRole('button', { name: 'Pedir' }).click();
  await expect(guest.locator('.bust-overlay')).toContainText('Ana repitió el 3', { timeout: 6_000 });
  await expect(guest.locator('.bust-banner')).toContainText('Ana repitió el 3 y perdió 3 cartas');
  await expect(guest.locator('.bust-banner .card[data-v="3"]')).toHaveCount(1);
  // Y Ana, en su pantalla, lo lee en segunda persona.
  await expect(host.locator('.bust-banner')).toContainText('Repetiste el 3');

  await hostCtx.close();
  await guestCtx.close();
});
