import { createRoot } from 'react-dom/client'
import App from './App'
import ScreenOverlay from './ScreenOverlay'
import EditorWindow from './EditorWindow'
import './index.css'

// One bundle, three windows: the studio, the see-through annotation layer (#overlay) and the recording editor (#editor).
const h = location.hash
createRoot(document.getElementById('root')).render(h === '#overlay' ? <ScreenOverlay /> : h === '#editor' ? <EditorWindow /> : <App />)
