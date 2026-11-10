import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:xr` serves over HTTPS on your LAN so a headset (Quest, Vision Pro, etc.)
// can open it — WebXR requires a secure context except on localhost.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'xr' ? [basicSsl()] : [],
}));
