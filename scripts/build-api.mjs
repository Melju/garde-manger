// Empaquette server/push-digest.ts (+ la logique partagée de src/) en api/push-digest.js pour Vercel.
import { build } from 'esbuild'
await build({
  entryPoints: ['server/push-digest.ts'],
  outfile: 'api/push-digest.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['web-push'],
  banner: { js: '// Fichier généré par scripts/build-api.mjs : ne pas éditer.' },
})
