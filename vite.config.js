import { resolve } from 'path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import obfuscator from 'vite-plugin-javascript-obfuscator';

export default defineConfig({
  // This matches your GitHub repository name
  base: '/account.systemtype/', 
  plugins: [
    tailwindcss(),
    obfuscator({
      options: {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 1,
        deadCodeInjection: true,
        debugProtection: true, // Stops people from using "Inspect Element" easily
        debugProtectionInterval: 2000,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: true,
        renameGlobals: false,
        selfDefending: true,
        simplify: true,
        splitStrings: true,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 1,
        unicodeEscapeSequence: false
      },
    }),
  ],
  build: {
    outDir: 'dist',
    minify: 'terser',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ask: resolve(__dirname, 'ask.html'), 
        general: resolve(__dirname, 'general.html'),
      },
    },
  }
});
