// Empaquette server/*.ts (+ la logique partagée de src/) en api/push-digest.js pour Vercel.
import { build } from 'esbuild'
for (const name of ['push-digest', 'push-shopping']) await build({
  entryPoints: [`server/${name}.ts`],
  outfile: `api/${name}.js`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['web-push'],
  banner: { js: '// Fichier généré par scripts/build-api.mjs : ne pas éditer.' },
})
