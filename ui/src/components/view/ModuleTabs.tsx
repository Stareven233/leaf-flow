import { For } from 'solid-js'
import type { Module } from '@/types/project'
import { useScroll } from '@/utils/hooks/useScroll'
import { useDecodedParams } from '@/utils/hooks/useDecodedParams'
import { useAppNavigate } from '@/utils/routes'
import { ModuleIcon } from '@/components/common/Icons'

interface ModuleTabsProps {
  modules: Module[]
}

export default function ModuleTabs(props: ModuleTabsProps) {
  const params = useDecodedParams()
  const navigate = useAppNavigate()
  const scroll = useScroll()

  const enabledModules = () => props.modules.filter((m) => !m.disabled)

  const isActiveModule = (key: string) => key === params.module

  const switchModule = (key: string) => {
    navigate('project', params.project!, key)
  }

  return (
    <nav ref={scroll.ref} class="flex space-x-4 border-b border-gray-200 bg-white">
      <For each={enabledModules()}>
        {(m) => (
          <button
            class={`py-3 px-4 border-b-2 cursor-pointer font-medium text-md whitespace-nowrap flex items-center gap-2 transition-colors ${
              isActiveModule(m.key)
                ? 'border-green-200 text-green-500 bg-green-50'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => switchModule(m.key)}
          >
            <ModuleIcon /> {m.name}
          </button>
        )}
      </For>
    </nav>
  )
}
