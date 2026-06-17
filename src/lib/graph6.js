const GRAPH6_HEADER = '>>graph6<<'

const decodeGraph6Value = char => {
  const code = char.charCodeAt(0)
  if (Number.isNaN(code) || code < 63 || code > 126) {
    throw new Error(`Invalid graph6 character "${ char }"`)
  }
  return code - 63
}

const decodeGraphOrder = values => {
  if (!values.length) {
    throw new Error('Graph6 string is empty')
  }
  if (values[0] !== 63) {
    return { order: values[0], startIndex: 1 }
  }
  if (values.length < 4) {
    throw new Error('Graph6 string is missing vertex-count data')
  }
  if (values[1] !== 63) {
    const order = values.slice(1, 4).reduce((count, value) => (count * 64) + value, 0)
    return { order, startIndex: 4 }
  }
  if (values.length < 8) {
    throw new Error('Graph6 string is missing extended vertex-count data')
  }
  const order = values.slice(2, 8).reduce((count, value) => (count * 64) + value, 0)
  return { order, startIndex: 8 }
}

export const parseGraph6 = input => {
  const trimmedInput = input.trim()
  const valueString = trimmedInput.startsWith(GRAPH6_HEADER)
    ? trimmedInput.slice(GRAPH6_HEADER.length)
    : trimmedInput

  const values = valueString.split('').map(decodeGraph6Value)
  const { order, startIndex } = decodeGraphOrder(values)
  const dataValues = values.slice(startIndex)
  const edgeCount = order * (order - 1) / 2
  const expectedDataLength = Math.ceil(edgeCount / 6)

  if (dataValues.length !== expectedDataLength) {
    throw new Error(`Graph6 edge data length is invalid (expected ${ expectedDataLength } characters, received ${ dataValues.length })`)
  }

  const matrix = [...Array(order)].map(() => Array(order).fill(0))

  let bitIndex = 0
  for (let i = 0; i < order; i += 1) {
    for (let j = i + 1; j < order; j += 1) {
      const dataValue = dataValues[Math.floor(bitIndex / 6)]
      const offset = 5 - (bitIndex % 6)
      const edge = (dataValue >> offset) & 1
      matrix[i][j] = edge
      matrix[j][i] = edge
      bitIndex += 1
    }
  }

  return matrix
}
