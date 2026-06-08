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

export default defineConfig({
  base,
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
})
