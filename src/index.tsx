import React from 'react'
import ReactDOM from 'react-dom/client'
import { Router } from 'wouter'
import { createGlobalStyle } from 'styled-components'
import App from './App'

const GlobalStyle = createGlobalStyle`
  html, body {
    margin: 4px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 16px;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }
`

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

root.render(
  <React.StrictMode>
    <GlobalStyle />
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
)
