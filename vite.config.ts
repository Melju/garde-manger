import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// HTTPS activé uniquement avec `npm run dev:https` (nécessaire pour la
// caméra/scan sur un téléphone via le réseau local — getUserMedia exige
// un contexte sécurisé). Le dev normal reste en HTTP.
const useHttps = process.env.HTTPS === 'true'

// Chemin de base selon l'hébergeur :
// - GitHub Pages sert l'app sous /garde-manger/ (sous-chemin du domaine github.io)
// - Vercel et le dev local la servent à la racine (/)
// On détecte GitHub Actions via la variable d'env GITHUB_ACTIONS.
const base = process.env.GITHUB_ACTIONS ? '/garde-manger/' : '/'

// Identifiant de build : injecté dans l'appli et publié dans version.json.
// Un téléphone resté ouvert sur une ancienne version le compare pour savoir qu'il doit se recharger.
const BUILD_ID = Date.now().toString(36)
const versionFile = {
  name: 'version-file',
  generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) })
  },
}

export default defineConfig({
  base,
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), versionFile, ...(useHttps ? [basicSsl()] : [])],
})
