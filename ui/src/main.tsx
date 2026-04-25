import { render } from 'solid-js/web'
import { Router } from '@solidjs/router'
import App from './App'
import { routes } from '@/utils/routes'

import './style.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found')
}

render(() => <Router root={App}>{routes}</Router>, root)
