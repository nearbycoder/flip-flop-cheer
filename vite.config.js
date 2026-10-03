import { defineConfig } from 'vite';

// host: true lets phones on the same Wi-Fi open the game.
export default defineConfig({
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
