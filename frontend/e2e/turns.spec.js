import { test, expect } from '@playwright/test';
import { expectTurnOf, idOf, newHotseatGame, rigDeck, seat, serverState } from './helpers.js';

// Cada test crea su propia partida por la UI y fija el orden del mazo con el
// soporte e2e: el resultado nunca depende de que "salga" una carta por azar.

test('Caso 1 — turno exitoso: sacar, plantarse y guardar en el turno siguiente', async ({ page, request }) => {
  const gameId = await newHotseatGame(page, ['Ana', 'Beto']);
  await rigDeck(request, gameId, [3, 7]);

  await expectTurnOf(page, 'Ana');
  await expect(page.locator('#deck-pile')).toContainText('110 cartas');
  // Regla: no se puede plantar sin haber sacado al menos una carta.
  await expect(page.getByRole('button', { name: 'Plantarse' })).toBeDisabled();

  // Sacar una carta: aparece delante de Ana y el mazo baja a 109.
  await page.getByRole('button', { name: 'Pedir' }).click();
  await expect(seat(page, 'Ana').locator('.card[data-v="3"]')).toHaveCount(1);
  await expect(page.locator('#deck-pile')).toContainText('109 cartas');
  await expect(page.locator('.event-chip')).toContainText('Sacó 3');
  await expectTurnOf(page, 'Ana'); // sin pérdida, sigue siendo su turno

  // Finalizar voluntariamente: el turno pasa a Beto y la carta queda delante de Ana.
  await page.getByRole('button', { name: 'Plantarse' }).click();
  await expectTurnOf(page, 'Beto');
  await expect(seat(page, 'Ana').locator('.card')).toHaveCount(1);
  await expect(seat(page, 'Ana').locator('.points')).toHaveText('0 pts');

  await page.getByRole('button', { name: 'Pedir' }).click(); // Beto saca 7
  await expect(seat(page, 'Beto').locator('.card[data-v="7"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Plantarse' }).click();

  // Nuevo turno de Ana: guarda las cartas que tenía delante del turno anterior.
  await expectTurnOf(page, 'Ana');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(seat(page, 'Ana').locator('.points')).toHaveText('3 pts');
  await expect(seat(page, 'Ana')).toContainText('Sin cartas a la vista');

  // El backend confirma el mismo estado que muestra la UI.
  const s = await serverState(request, gameId);
  const ana = idOf(s, 'Ana');
  expect(s.currentPlayerId).toBe(ana);
  expect(s.fronts[ana]).toEqual([]);
  expect(s.stashed[ana].sum).toBe(3);
  expect(s.fronts[idOf(s, 'Beto')]).toEqual([7]);
  expect(s.deckRemaining).toBe(108);
});

test('Caso 2 — turno perdido: 3 cartas delante y una repetida', async ({ page, request }) => {
  const gameId = await newHotseatGame(page, ['Ana', 'Beto']);
  // Ana ya guardó un 8 en un turno anterior: así se ve que el bust no toca los puntos.
  await rigDeck(request, gameId, [8, 1, 2, 5, 9, 5]);
  await page.getByRole('button', { name: 'Pedir' }).click(); // Ana 8
  await page.getByRole('button', { name: 'Plantarse' }).click();
  await page.getByRole('button', { name: 'Pedir' }).click(); // Beto 1
  await page.getByRole('button', { name: 'Plantarse' }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(seat(page, 'Ana').locator('.points')).toHaveText('8 pts');

  // Tres cartas distintas delante: todavía no pierde.
  for (const v of [2, 5, 9]) {
    await page.getByRole('button', { name: 'Pedir' }).click();
    await expect(seat(page, 'Ana').locator(`.card[data-v="${v}"]`)).toHaveCount(1);
  }
  await expect(seat(page, 'Ana').locator('.card')).toHaveCount(3);
  await expect(page.locator('.bust-banner')).toHaveCount(0);

  // Saca un 5 repetido con 3 cartas delante → pierde el turno.
  await page.getByRole('button', { name: 'Pedir' }).click();
  await expect(page.getByRole('alert')).toContainText('Turno perdido');
  await expect(seat(page, 'Ana')).toContainText('Sin cartas a la vista');
  await expect(seat(page, 'Ana').locator('.points')).toHaveText('8 pts'); // no suma nada
  await expectTurnOf(page, 'Beto');
  await expect(seat(page, 'Beto').locator('.card[data-v="1"]')).toHaveCount(1); // Beto intacto

  const s = await serverState(request, gameId);
  const ana = idOf(s, 'Ana');
  expect(s.lastEvent).toMatchObject({ type: 'DRAW', value: 5, bust: true });
  expect(s.fronts[ana]).toEqual([]);
  expect(s.stashed[ana].sum).toBe(8);
  expect(s.currentPlayerId).toBe(idOf(s, 'Beto'));
});

test('Repetida con solo 2 cartas delante: sigue jugando', async ({ page, request }) => {
  const gameId = await newHotseatGame(page, ['Ana', 'Beto']);
  await rigDeck(request, gameId, [6, 6]);
  await page.getByRole('button', { name: 'Pedir' }).click();
  await page.getByRole('button', { name: 'Pedir' }).click();

  await expect(seat(page, 'Ana').locator('.card[data-v="6"]')).toHaveCount(2);
  await expect(page.locator('.bust-banner')).toHaveCount(0);
  await expectTurnOf(page, 'Ana');
});

test('Robo: se roban del rival las cartas del valor recién sacado', async ({ page, request }) => {
  const gameId = await newHotseatGame(page, ['Ana', 'Beto']);
  await rigDeck(request, gameId, [4, 7, 4]);
  await page.getByRole('button', { name: 'Pedir' }).click(); // Ana 4
  await page.getByRole('button', { name: 'Pedir' }).click(); // Ana 7
  await page.getByRole('button', { name: 'Plantarse' }).click();

  // Sin haber sacado, Beto no puede robar.
  await expect(page.getByRole('button', { name: 'Robar', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Pedir' }).click(); // Beto 4

  await page.getByRole('button', { name: 'Robar los 4' }).click();
  // Solo el 4 de Ana es robable; el 7 no.
  await expect(seat(page, 'Ana').getByRole('button', { name: 'Robar carta 4' })).toHaveCount(1);
  await expect(seat(page, 'Ana').getByRole('button', { name: 'Robar carta 7' })).toHaveCount(0);
  await seat(page, 'Ana').getByRole('button', { name: 'Robar carta 4' }).click();

  await expect(page.locator('.event-chip')).toContainText('Robó 1 × 4');
  await expect(seat(page, 'Beto').locator('.card[data-v="4"]')).toHaveCount(2);
  await expect(seat(page, 'Ana').locator('.card')).toHaveCount(1);
  await expect(seat(page, 'Ana').locator('.card[data-v="7"]')).toHaveCount(1);
  await expectTurnOf(page, 'Beto'); // robar no termina el turno

  const s = await serverState(request, gameId);
  expect(s.fronts[idOf(s, 'Beto')]).toEqual([4, 4]);
  expect(s.fronts[idOf(s, 'Ana')]).toEqual([7]);
});

test('Fin de partida: mazo agotado, ganador y registro en el histórico', async ({ page, request }) => {
  const gameId = await newHotseatGame(page, ['Ana', 'Beto']);
  await rigDeck(request, gameId, [5, 1], true); // solo quedan 2 cartas
  await page.getByRole('button', { name: 'Pedir' }).click(); // Ana 5
  await page.getByRole('button', { name: 'Plantarse' }).click();
  await page.getByRole('button', { name: 'Pedir' }).click(); // Beto 1 → mazo vacío

  // Las cartas expuestas se guardan solas y se calcula el ganador.
  await expect(page.locator('.felt-turn strong')).toHaveText('Partida terminada');
  const result = page.locator('.panel.result');
  await expect(result).toContainText('Ana se lleva la noche');
  await expect(result.locator('li').nth(0)).toContainText('Ana — 5 pts');
  await expect(result.locator('li').nth(1)).toContainText('Beto — 1 pts');

  await page.goto('/history');
  const item = page.getByTestId('history-item').filter({ hasText: gameId.slice(0, 8) });
  await expect(item).toContainText('ganó Ana');
  await expect(item).toContainText('Ana — 5 pts · 1×5');
  await expect(item).toContainText('Beto — 1 pts · 1×1');
});
