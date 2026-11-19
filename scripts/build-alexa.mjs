// Empaquette server/alexa-edge.ts (+ la logique partagée de src/) en fonction du NAS supabase/functions/alexa/index.ts.
import { build } from 'esbuild'
await build({
  entryPoints: ['server/alexa-edge.ts'],
  outfile: 'supabase/functions/alexa/index.ts',
  bundle: true,
  platform: 'neutral',
  format: 'esm',
  target: 'es2022',
  mainFields: ['module', 'main'],
  external: ['node:crypto', 'npm:@supabase/supabase-js@2'],
  banner: { js: '// @ts-nocheck\n// Fichier généré par scripts/build-alexa.mjs : ne pas éditer.' },
})
