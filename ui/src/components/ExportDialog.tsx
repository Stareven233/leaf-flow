import { type Component, Show, createMemo, createSignal } from 'solid-js'
import NButton from '@/components/common/NButton'
import RadioInput from '@/components/argumentInput/RadioInput'

interface ExportDialogProps {
  visible: boolean
  title: string
  prompt: string
  placeholder: string
  filename: string
  dirOptions: string[]
  onFilenameChange: (value: string) => void
  onCancel: () => void
  onConfirm: (action: 'export' | 'save', dir?: string) => void
}

const ExportDialog: Component<ExportDialogProps> = (props) => {
  const [locationValue, setLocationValue] = createSignal<string>(props.dirOptions[0] ?? '<no>')

  const locationArg = createMemo(() => ({
    key: '_',
    name: '_',
    value: locationValue(),
    options: props.dirOptions,
    required: true,
  }))

  const isFilenameValid = createMemo(() => props.filename.trim().length > 0)

  const handleConfirm = (action: 'export' | 'save') => {
    if (!isFilenameValid()) {
      return
    }
    if (action === 'export') {
      props.onConfirm(action)
    } else if (action === 'save' && locationValue() !== '<no>') {
      props.onConfirm(action, locationValue())
    }
  }

  return (
    <Show when={props.visible}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div class="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
          <h3 class="text-lg font-semibold text-green-700 mb-2">{props.title}</h3>
          <p class="text-sm text-gray-500 mb-2">{props.prompt}</p>
          <input
            type="text"
            value={props.filename}
            onInput={(e) => props.onFilenameChange(e.currentTarget.value)}
            class="w-full px-3 py-2 border border-green-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
            placeholder={props.placeholder}
          />

          <div class="mt-4">
            <p class="text-gray-500 mb-2">是否写入目录（覆盖）</p>
            <RadioInput
              argument={locationArg()}
              setArgument={(updates) => setLocationValue(updates.value as string)}
            />
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <NButton
              onClick={() => handleConfirm('save')}
              disabled={!isFilenameValid() || locationValue() === '<no>'}
              variant="warn"
            >
              写入
            </NButton>
            <NButton onClick={props.onCancel} variant="secondary">
              取消
            </NButton>
            <NButton onClick={() => handleConfirm('export')} disabled={!isFilenameValid()}>
              导出
            </NButton>
          </div>
        </div>
      </div>
    </Show>
  )
}

export default ExportDialog
