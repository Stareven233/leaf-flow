import { For } from 'solid-js'
import type { Project } from '@/types/project'
import { useScroll } from '@/utils/hooks/useScroll'
import { useDecodedParams } from '@/utils/hooks/useDecodedParams'
import { useAppNavigate } from '@/utils/routes'

interface BranchTabsProps {
  branches: Project[]
}

export default function BranchTabs(props: BranchTabsProps) {
  const params = useDecodedParams()

  const navigate = useAppNavigate()
  const scroll = useScroll()

  const switchBranch = (key: string) => {
    navigate('flow', params.flow!, key)
  }

  return (
    <nav ref={scroll.ref} class="flex space-x-4 border-b border-gray-200 bg-white">
      <For each={props.branches}>
        {(b) => (
          <button
            class={`py-3 px-4 border-b-2 cursor-pointer font-medium text-md whitespace-nowrap flex items-center gap-2 transition-colors ${
              b.key === params.branch
                ? 'border-green-200 text-green-500 bg-green-50'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => switchBranch(b.key)}
          >
            {b.name}
          </button>
        )}
      </For>
    </nav>
  )
}
