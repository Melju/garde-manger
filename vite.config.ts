import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// HTTPS activé uniquement avec `npm run dev:https` (nécessaire pour la
// caméra/scan sur un téléphone via le réseau local — getUserMedia exige
// un contexte sécurisé). Le dev normal reste en HTTP.
const useHttps = process.env.HTTPS === 'true'

export default defineConfig(({ command }) => ({
  // Publié sur GitHub Pages sous https://melju.github.io/garde-manger/
  // donc les assets doivent être préfixés par /garde-manger/ en production.
  base: command === 'build' ? '/garde-manger/' : '/',
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
}))
