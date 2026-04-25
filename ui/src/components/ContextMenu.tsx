import { For, Show } from 'solid-js'

export interface MenuItem {
  label: string
  onClick: () => void
}

interface ContextMenuProps {
  visible: boolean
  x: number
  y: number
  items: MenuItem[]
}

export default function ContextMenu(props: ContextMenuProps) {
  return (
    <Show when={props.visible}>
      <div
        class="fixed bg-white border-none rounded-lg shadow-xl z-50 py-1 min-w-30 flex flex-col text-center"
        style={{ top: `${props.y}px`, left: `${props.x}px` }}
      >
        <For each={props.items}>
          {(item) => (
            <button
              onClick={item.onClick}
              class="w-full px-2 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors"
            >
              {item.label}
            </button>
          )}
        </For>
      </div>
    </Show>
  )
}
