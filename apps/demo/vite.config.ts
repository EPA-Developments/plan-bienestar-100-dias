import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // El exports map de @medplum/definitions no expone los JSON crudos;
      // los alcanzamos directo para embeberlos en el bundle del navegador.
      'fhir-definitions': fileURLToPath(
        new URL('../../node_modules/@medplum/definitions/dist/fhir/r4', import.meta.url),
      ),
    },
  },
});
