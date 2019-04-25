import find from 'lodash/find'
import toUpper from 'lodash/toUpper'
import findStatePiece from './findStatePiece'
import joinWith from './joinWith'
import { consoleGroup } from './logger'

export const fetchMap = type =>
  type === 'list' ? 'fetchingList' : 'fetchingInfo'

export const addToItem = (item, id, attrs) =>
  item && `${item.id}` === `${id}` ? { ...item, ...attrs } : item

export const stateMiddleware = (store, { name, stateId, debugActions }) => {
  const piece = findStatePiece(store.state, name, stateId)
  const path = joinWith('@', name, stateId)
  const setState = (newState, callback) => {
    store.setState({ [path]: newState })
    callback && callback(store.state)
  }
  const log = (operation = 'FIND', actionType = 'REQUEST') => newState => {
    if (!debugActions) return null
    const colors = {
      REQUEST: 'yellow',
      SUCCESS: 'green',
      FAIL: 'red',
    }
    const title = `${toUpper(operation)} ${actionType} [${path}]`
    const state = findStatePiece(newState, name, stateId)
    consoleGroup(title, colors[actionType])(state, newState)
  }
  return [piece, setState, log]
}

const getRequest = (store, { operation, ...options }) => {
  const [piece, setState, log] = stateMiddleware(store, options)
  const newState = {
    ...piece,
    [fetchMap(operation)]: true,
    [`${operation}Error`]: null,
  }
  setState(newState, log(operation))
  return true
}

const getSuccess = (store, { operation, ...options }, data) => {
  const [piece, setState, log] = stateMiddleware(store, options)
  const newState = {
    ...piece,
    [fetchMap(operation)]: false,
    [`${operation}Error`]: null,
    [operation]: data,
  }
  setState(newState, log(operation, 'SUCCESS'))
  return data
}

const getFail = (store, { operation, ...options }, error) => {
  const [piece, setState, log] = stateMiddleware(store, options)
  const newState = {
    ...piece,
    [fetchMap(operation)]: false,
    [`${operation}Error`]: error.message,
  }
  setState(newState, log(operation, 'FAIL'), false)
  return false
}

const setInfo = (store, options) => {
  const [piece, setState, log] = stateMiddleware(store, options)
  const info = find(piece.list, item => `${item.id}` === `${options.id}`)
  if (info) {
    const newState = {
      ...piece,
      info,
    }
    setState(newState, log('SET', 'INFO'))
    return info
  }
  return false
}

const saveRequest = (store, options, id) => {
  const [piece, setState, log] = stateMiddleware(store, options)
  const status = { saving: true, saveError: null }
  const newState = {
    ...piece,
    ...status,
    info: id ? addToItem(piece.info, id, status) : piece.info,
    list: id ? piece.list.map(item => addToItem(item, id, status)) : piece.list,
  }
  setState(newState, log('SAVE'))
  return true
}

const saveSuccess = (store, options, { id, data }, addCreatedToTop) => {
  const [piece, setState, log] = stateMiddleware(store, options)
  const status = { saving: false, saveError: null }
  const old = id ? find(piece.list, item => `${item.id}` === `${id}`) : data
  const saved = { ...old, ...data, ...status }
  const addToList = (list, item, toTop) =>
    toTop ? [item, ...list] : [...list, item]
  const newState = {
    ...piece,
    ...status,
    saved,
    list: id
      ? piece.list.map(item => (`${item.id}` === `${id}` ? saved : item))
      : addToList(piece.list, saved, addCreatedToTop),
    info: saved,
  }
  setState(newState, log('SAVE', 'SUCCESS'))
  return saved
}

const saveFail = (store, options, { error, id }) => {
  const [piece, setState, log] = stateMiddleware(store, options)
  const status = { saving: false, saveError: error.message }
  const newState = {
    ...piece,
    ...status,
    info: id ? addToItem(piece.info, id, status) : piece.info,
    list: id ? piece.list.map(item => addToItem(item, id, status)) : piece.list,
  }
  setState(newState, log('SAVE', 'FAIL'), false)
  return false
}

const destroyRequest = (store, options, id) => {
  const [piece, setState, log] = stateMiddleware(store, options)
  const status = { destroying: true, destroyError: null }
  const newState = {
    ...piece,
    ...status,
    info: addToItem(piece.info, id, status),
    list: piece.list.map(item => addToItem(item, id, status)),
  }
  setState(newState, log('DESTROY'))
  return true
}

const destroySuccess = (store, options, id) => {
  const [piece, setState, log] = stateMiddleware(store, options)
  const destroyed = find(piece.list, item => `${item.id}` === `${id}`)
  const newState = {
    ...piece,
    destroyed,
    destroying: false,
    list: piece.list.filter(item => item.id !== id),
    info: piece.info && piece.info.id === id ? null : piece.info,
  }
  setState(newState, log('DESTROY', 'SUCCESS'))
  return destroyed
}

const destroyFail = (store, options, { error, id }) => {
  const [piece, setState, log] = stateMiddleware(store, options)
  const status = { destroying: false, destroyError: error.message }
  const newState = {
    ...piece,
    ...status,
    info: addToItem(piece.info, id, status),
    list: piece.list.map(item => addToItem(item, id, status)),
  }
  setState(newState, log('DESTROY', 'FAIL'), false)
  return false
}

export default {
  getRequest,
  getSuccess,
  getFail,
  saveRequest,
  saveSuccess,
  saveFail,
  destroyRequest,
  destroySuccess,
  destroyFail,
  setInfo,
}