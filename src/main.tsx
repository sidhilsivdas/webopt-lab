import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// No <StrictMode>: its double-invoked effects and renders would inflate
// the very numbers this app is measuring.
createRoot(document.getElementById('root')!).render(<App />)
