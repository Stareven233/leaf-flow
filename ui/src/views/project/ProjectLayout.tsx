import { Component } from 'solid-js'
import type { RouteSectionProps } from '@solidjs/router'
import { useDecodedParams } from '@/utils/hooks/useDecodedParams'
import ProjectConfig from '@/views/project/ProjectConfig'

const ProjectLayout: Component<RouteSectionProps> = (props) => {
  const params = useDecodedParams()

  return (
    <>
      {}
      <div style={{ display: params.module ? 'none' : 'block' }}>
        <ProjectConfig />
      </div>

      {}
      {params.module && props.children}
    </>
  )
}

export default ProjectLayout
