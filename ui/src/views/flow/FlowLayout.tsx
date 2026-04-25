import { Component } from 'solid-js'
import type { RouteSectionProps } from '@solidjs/router'
import { useDecodedParams } from '@/utils/hooks/useDecodedParams'
import FlowConfig from '@/views/flow/FlowConfig'

const FlowLayout: Component<RouteSectionProps> = (props) => {
  const params = useDecodedParams()

  return (
    <>
      {}
      <div style={{ display: params.branch ? 'none' : 'block' }}>
        <FlowConfig />
      </div>

      {}
      {params.branch && props.children}
    </>
  )
}

export default FlowLayout
