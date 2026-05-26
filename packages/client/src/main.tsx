import { render } from 'preact'
import '@primer/css/dist/primer.css'
import 'highlight.js/styles/github.css'
import './app.css'
import { App } from './pages/App.js'

const root = document.getElementById('app')
if (root) render(<App />, root)
