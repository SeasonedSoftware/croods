import React from 'react'
import ReactDOM from 'react-dom'
import { CroodsProvider } from 'croods-light'

import './index.css'
import App from './App'

ReactDOM.render(
  <CroodsProvider
    baseUrl="https://reqres.in/api"
    debugActions
    debugRequests
    parseFetchResponse={({ data }) => data.data}
    parseResponse={({ data }) => data}
  >
    <App />
  </CroodsProvider>,
  document.getElementById('root'),
)