import { expect } from '@playwright/test';

export const API = 'http://localhost:8081';

/**
 * Abre la app, entra a "Nueva" y crea una partida hotseat por la UI, como lo
 * haría un usuario. Devuelve el id de la partida (sale de la URL /game/:id).
 */
export async function newHotseatGame(page, names) {
  await page.goto('/');
  await page.goto('/setup');
  await page.getByRole('tab', { name: 'Un dispositivo' }).click();
  if (names.length > 2) {
    for (let i = 2; i < names.length; i++) {
      await page.getByRole('group', { name: 'Cantidad de jugadores' }).getByRole('button', { name: '+' }).click();
    }
  }
  for (let i = 0; i < names.length; i++) {
    await page.getByPlaceholder(`Nombre del jugador ${i + 1}`).fill(names[i]);
  }
  await page.getByRole('button', { name: 'Crear y empezar' }).click();
  await page.waitForURL(/\/game\/[0-9a-f-]{36}$/);
  return page.url().split('/game/')[1];
}

/**
 * Datos de prueba controlados: fija qué cartas salen primero del mazo
 * (endpoint del perfil e2e). No juega por el usuario: solo ordena el mazo.
 */
export async function rigDeck(request, gameId, values, truncate = false) {
  const res = await request.post(`${API}/api/test/games/${gameId}/deck`, { data: { values, truncate } });
  expect(res.status(), await res.text()).toBe(204);
}

/** Estado según el backend (fuente de verdad), para asserts que la UI no muestra. */
export async function serverState(request, gameId) {
  const res = await request.get(`${API}/api/games/${gameId}`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

/** Panel (asiento) de un jugador en la mesa. */
export function seat(page, name) {
  return page.locator('.seat-panel').filter({ has: page.locator('h2', { hasText: name }) });
}

export function idOf(state, name) {
  return state.players.find((p) => p.name === name).id;
}

/** "Turno de X" (texto plano arriba a la izquierda de la mesa). */
export async function expectTurnOf(page, name) {
  await expect(page.locator('.felt-turn')).toContainText('Turno de');
  await expect(page.locator('.felt-turn strong')).toHaveText(name);
}
