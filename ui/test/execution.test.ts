import { describe, test, expect } from 'bun:test'
import { renderCommand } from '../src/utils/execution'

describe('renderCommand', () => {
  test('缺失参数', () => {
    const command = 'hello #{name}'
    const args = { age: 30 }
    const expected = 'hello #{name}'
    const result = renderCommand(command, args as any)
    expect(result).toBe(expected)
  })

  test('前后缀', () => {
    const command = 'hello #{sm #{names} sb}'
    const args = {
      names: ['kx', 'klx'],
    }
    const expected = 'hello sm kx sb sm klx sb'
    const result = renderCommand(command, args as any)
    expect(result).toBe(expected)
  })

  test('template', () => {
    const command = 'sm #{} kx 4000+'
    const args = {
      names: [30, 66, 131],
    }
    const expected = 'sm #{} kx 4000+'
    const result = renderCommand(command, args as any)
    expect(result).toBe(expected)
  })
})
