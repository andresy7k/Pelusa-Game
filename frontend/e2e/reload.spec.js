import { test, expect } from '@playwright/test';
import { expectTurnOf, newHotseatGame, rigDeck, seat } from './helpers.js';

// Recargar la página (F5) en medio de una partida muestra la mesa ACTUAL del
// servidor, no la recién creada que viajó en el historial del navegador.
test('Recargar en medio de la partida muestra el estado actual', async ({ page, request }) => {
  const gameId = await newHotseatGame(page, ['Ana', 'Beto']);
  await rigDeck(request, gameId, [3, 7]);

  await page.getByRole('button', { name: 'Pedir' }).click();
  await expect(page.locator('#deck-pile')).toContainText('109 cartas');
  await page.getByRole('button', { name: 'Plantarse' }).click();
  await expectTurnOf(page, 'Beto');

  await page.reload();

  await expectTurnOf(page, 'Beto');
  await expect(page.locator('#deck-pile')).toContainText('109 cartas');
  await expect(seat(page, 'Ana').locator('.card[data-v="3"]')).toHaveCount(1);
  // Y se puede seguir jugando (antes: "Todavía no es tu turno").
  await page.getByRole('button', { name: 'Pedir' }).click();
  await expect(seat(page, 'Beto').locator('.card[data-v="7"]')).toHaveCount(1);
});
