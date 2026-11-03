// Pruebas funcionales (Playwright + JavaScript) contra la app REAL:
// backend Spring Boot (perfil e2e, H2 en memoria) + frontend Vite.
// Puertos propios (8081/5174) para no chocar con un backend de desarrollo
// en :8080: si se reutilizara ese, no tendría el soporte /api/test/**.
//
// Requisito: el jar del backend compilado (cd backend && mvn -DskipTests package)
// y un JDK 25 en JAVA_HOME o en el PATH.
import { defineConfig, devices } from '@playwright/test';

const java = process.env.JAVA_HOME ? `"${process.env.JAVA_HOME}/bin/java"` : 'java';
const API = 'http://localhost:8081'; // mismo valor que e2e/helpers.js

export default defineConfig({
  testDir: './e2e',
  // Un solo worker: los casos comparten backend y deben leerse en orden en el reporte.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  // La primera navegación al tablero compila el chunk en Vite dev: más de 5 s en frío.
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Sin animaciones de vuelo: la UI no oculta la carta mientras "vuela".
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `${java} -jar ../backend/target/pelusa-game-0.1.0-SNAPSHOT.jar --spring.profiles.active=e2e`,
      url: `${API}/api/health`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174',
      env: { VITE_PROXY_TARGET: API },
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
