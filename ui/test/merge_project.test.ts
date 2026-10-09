import { mergeProjects } from '../src/utils/config'
import { Module, Argument } from '../src/types/project'
import { expect, test } from 'bun:test'

test('mergeProjects', () => {
  const baseYaml = `
name: BaseProject
desc: Base Description
modules:
  - name: module1
    desc: Module 1 Base
    template: cmd1
    arguments:
      - key: arg1
        desc: Arg 1 Base
        value: val1
      - key: arg2
        desc: Arg 2 Base
        value: val2
`

  const patchYaml = `
name: PatchProject
desc: Patch Description
newKey: ShouldBeIgnored
modules:
  - name: module1
    desc: Module 1 Patch
    arguments:
      - key: arg1
        value: val1_patched
      - key: arg3
        value: val3_new
  - name: module2
    desc: Module 2 New
`

  const result = mergeProjects([baseYaml, patchYaml])

  expect(result).not.toBeNull()
  if (!result) return

  expect(result.name).toBe('PatchProject')
  expect(result.desc).toBe('Patch Description')
  expect((result as any).newKey).toBeUndefined()

  const m1 = result.modules.find((m: Module) => m.name === 'module1')
  expect(m1).toBeDefined()
  expect(m1?.desc).toBe('Module 1 Patch')

  const m2 = result.modules.find((m: Module) => m.name === 'module2')
  expect(m2).toBeUndefined()

  const arg1 = m1?.arguments?.find((a: Argument) => a.key === 'arg1')
  expect(arg1?.value).toBe('val1_patched')

  const arg2 = m1?.arguments?.find((a: Argument) => a.key === 'arg2')
  expect(arg2?.value).toBe('val2')

  const arg3 = m1?.arguments?.find((a: Argument) => a.key === 'arg3')
  expect(arg3).toBeUndefined()
})
