import { test, expect } from '@playwright/test';
import { expectTurnOf, idOf, seat, serverState } from './helpers.js';

// Avatares: cada jugador elige su monstruo en el setup; elegir uno que ya
// tiene otro los intercambia, y la mesa muestra el de quien tiene el turno.

test('Cada jugador elige su monstruo y la mesa muestra el de quien juega', async ({ page, request }) => {
  await page.goto('/setup');
  await page.getByRole('tab', { name: 'Un dispositivo' }).click();
  await page.getByPlaceholder('Nombre del jugador 1').fill('Ana');
  await page.getByPlaceholder('Nombre del jugador 2').fill('Beto');

  // Por defecto cada uno tiene uno distinto (1 y 2).
  await expect(page.getByRole('button', { name: /Monstruo del jugador 1: Pelusa 1/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Monstruo del jugador 2: Pelusa 2/ })).toBeVisible();

  // Ana elige el 2, que era de Beto: se intercambian.
  await page.getByRole('button', { name: /Monstruo del jugador 1/ }).click();
  await page.locator('.avatar-option').filter({ has: page.locator('input[value="2"]') }).click();
  await expect(page.getByRole('button', { name: /Monstruo del jugador 1: Pelusa 2/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Monstruo del jugador 2: Pelusa 1/ })).toBeVisible();

  // Beto elige el 9.
  await page.getByRole('button', { name: /Monstruo del jugador 2/ }).click();
  await page.locator('.avatar-option').filter({ has: page.locator('input[value="9"]') }).click();

  await page.getByRole('button', { name: 'Crear y empezar' }).click();
  await page.waitForURL(/\/game\/[0-9a-f-]+$/);
  const gameId = page.url().split('/').pop();

  // Empieza el asiento 0 en e2e (sorteo fijo): el indicador lleva el monstruo de Ana.
  await expectTurnOf(page, 'Ana');
  await expect(page.locator('.felt-turn .avatar')).toHaveAttribute('data-v', '2');
  await expect(seat(page, 'Ana').locator('.avatar')).toHaveAttribute('data-v', '2');
  await expect(seat(page, 'Beto').locator('.avatar')).toHaveAttribute('data-v', '9');

  const s = await serverState(request, gameId);
  expect(s.players.find((p) => p.id === idOf(s, 'Ana')).avatar).toBe(2);
  expect(s.players.find((p) => p.id === idOf(s, 'Beto')).avatar).toBe(9);

  // Al pasar el turno, el indicador cambia al monstruo de Beto.
  await page.getByRole('button', { name: 'Pedir' }).click();
  await page.getByRole('button', { name: 'Plantarse' }).click();
  await expectTurnOf(page, 'Beto');
  await expect(page.locator('.felt-turn .avatar')).toHaveAttribute('data-v', '9');
});
