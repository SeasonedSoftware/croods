import { useContext, useEffect } from 'react'
import axios from 'axios'
import createHumps from 'lodash-humps/lib/createHumps'
import camelCase from 'lodash/camelCase'
import identity from 'lodash/identity'
import kebabCase from 'lodash/kebabCase'
import omit from 'lodash/omit'
import snakeCase from 'lodash/snakeCase'
import useGlobal from './store'
import findStatePiece from './findStatePiece'
import * as pr from './persistHeaders'
import Context from './Context'
import { responseLogger, requestLogger } from './logger'

const defaultParseResponse = ({ data }) => data
const defaultParseParams = snakeCase
const defaultUnparseParams = camelCase
const defaultUrlParser = kebabCase

const defaultHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

const useCroods = ({ name, stateId, ...opts }, autoFetch) => {
  const baseOptions = useContext(Context)
  const [state, actions] = useGlobal()
  const piece = findStatePiece(state, name, stateId)

  const options = { ...baseOptions, ...opts, name, stateId }
  const { baseUrl, debugRequests, cache, parseResponse } = options
  const { headers, credentials, requestTimeout } = options
  const { afterResponse, afterSuccess, afterFailure } = options
  const { persistHeaders, persistHeadersKey, persistHeadersMethod } = options
  const { parseParams, unparseParams, urlParser } = options
  const paramsParser = createHumps(parseParams || defaultParseParams)
  const paramsUnparser = createHumps(unparseParams || defaultUnparseParams)

  const defaultPath = `/${(urlParser || defaultUrlParser)(name)}`

  const buildApi = async () => {
    const persistedHeaders = persistHeaders
      ? await pr.getHeaders(
          persistHeadersMethod || localStorage,
          persistHeadersKey,
        )
      : {}
    const customHeaders = await (typeof headers === 'function'
      ? headers(defaultHeaders)
      : headers)
    return axios.create({
      baseURL: baseUrl,
      timeout: requestTimeout,
      withCredentials: !!credentials,
      credentials,
      headers: { ...defaultHeaders, ...persistedHeaders, ...customHeaders },
    })
  }

  const saveHeaders = response => {
    persistHeaders &&
      pr.saveHeaders(
        response,
        persistHeadersMethod || localStorage,
        persistHeadersKey,
      )
  }

  const doSuccess = (path, method) => async (response, parser = identity) => {
    debugRequests && responseLogger(path, method, response)
    saveHeaders(response)
    afterSuccess && (await afterSuccess(response))
    afterResponse && (await afterResponse(response))
    return paramsUnparser(parser(response))
  }

  const doFail = (path, method) => async error => {
    debugRequests && responseLogger(path, method, error)
    afterFailure && (await afterFailure(error))
    afterResponse && (await afterResponse(error))
    return false
  }

  const buildUrl = id => {
    const path = options.path || (id ? `${defaultPath}/${id}` : defaultPath)
    return path.replace(/([^https?:]\/)\/+/g, '$1')
  }

  const fetch = async id => {
    const api = await buildApi()
    const operation = id ? 'info' : 'list'
    const path = buildUrl(id)
    if (!id && !!piece.list.length && cache) return true
    const hasInfo =
      id && piece.list.length && actions.setInfo({ ...options, id })
    if (hasInfo && cache) return true
    debugRequests && requestLogger(path, 'GET')
    actions.getRequest({ ...options, operation })
    return api
      .get(path)
      .then(async response => {
        const {
          parseInfoResponse,
          parseListResponse,
          parseFetchResponse,
        } = options
        const parser =
          (id ? parseInfoResponse : parseListResponse) ||
          parseFetchResponse ||
          parseResponse ||
          defaultParseResponse
        const result = await doSuccess(path, 'GET')(response, parser)
        return actions.getSuccess({ ...options, operation }, result)
      })
      .catch(async error => {
        await doFail(path, 'GET')(error)
        return actions.getFail({ ...options, operation }, error)
      })
  }

  const save = id => async ({ $_addToTop, ...rawBody }) => {
    const api = await buildApi()
    const path = buildUrl(id)
    const method = id ? 'PUT' : 'POST'
    const body = paramsParser(omit(rawBody, 'id'))
    debugRequests && requestLogger(path, method, body)
    actions.saveRequest(options, id)
    const axiosMethod = id ? api.put : api.post
    return axiosMethod(path, body)
      .then(async response => {
        const {
          parseCreateResponse,
          parseUpdateResponse,
          parseSaveResponse,
        } = options
        const parser =
          (id ? parseUpdateResponse : parseCreateResponse) ||
          parseSaveResponse ||
          parseResponse ||
          defaultParseResponse
        const result = await doSuccess(path, method)(response, parser)
        return actions.saveSuccess(options, { id, data: result }, $_addToTop)
      })
      .catch(async error => {
        await doFail(path, method)(error)
        return actions.saveFail(options, { error, id })
      })
  }

  const destroy = id => async () => {
    if (!id) return false
    const api = await buildApi()
    const path = buildUrl(id)
    debugRequests && requestLogger(path, 'DELETE')
    actions.destroyRequest(options, id)
    return api
      .delete(path)
      .then(async response => {
        await doSuccess(path, 'DELETE')(response)
        return actions.destroySuccess(options, id)
      })
      .catch(async error => {
        await doFail(path, 'DELETE')(error)
        return actions.destroyFail(options, { error, id })
      })
  }

  const { id: givenId } = options

  useEffect(() => {
    autoFetch && fetch(givenId)
    // eslint-disable-next-line
  }, [givenId, autoFetch])

  return [piece, { fetch, save, destroy }]
}

export default useCroods
