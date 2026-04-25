import { useLocation, useNavigate } from '@solidjs/router'
import { Component, onMount, Show, createSignal, JSX } from 'solid-js'
import { useProjectStore } from '@/stores/project'
import { useFlowStore } from '@/stores/flow'
import { useDecodedParams } from '@/utils/hooks/useDecodedParams'

export function withProjectGuard<P extends object>(WrappedComponent: Component<P>): Component<P> {
  return (props: P): JSX.Element => {
    const params = useDecodedParams()
    const navigate = useNavigate()
    const location = useLocation()
    const projectStore = useProjectStore()
    const [isReady, setIsReady] = createSignal(false)

    onMount(async () => {
      const pkey = params.project
      let mkey = params.module

      if (!pkey) {
        setIsReady(true)
        return
      }

      const p = await projectStore.fetch(pkey)
      if (!p || !p.modules) {
        navigate('/not-found')
        return
      }

      if (!mkey && location.state === 'first-choice') {
        if (!p.modules || p.modules.length === 0) {
          navigate('/not-found')
          return
        }
        navigate(`/projects/${pkey}/${p.modules[0].key}`)
      }

      if (!mkey) {
        setIsReady(true)
        return
      }

      const m = p.modules.find((m) => m.key === mkey)
      if (!m) {
        navigate('/not-found')
        return
      }
      setIsReady(true)
    })

    return (
      <Show
        when={isReady()}
        fallback={<div class="flex items-center justify-center min-h-screen">加载中...</div>}
      >
        <WrappedComponent {...props} />
      </Show>
    )
  }
}

export function withFlowGuard<P extends object>(WrappedComponent: Component<P>): Component<P> {
  return (props: P): JSX.Element => {
    const params = useDecodedParams()
    const navigate = useNavigate()
    const flowStore = useFlowStore()
    const location = useLocation()
    const [isReady, setIsReady] = createSignal(false)

    onMount(async () => {
      let fkey = params.flow
      const bkey = params.branch

      if (!fkey) {
        setIsReady(true)
        return
      }

      let f = await flowStore.fetch(fkey)
      if (!f || !f.branches) {
        navigate('/not-found')
        return
      }

      if (!bkey && location.state === 'first-choice') {
        if (!f.branches || f.branches.length === 0) {
          navigate('/not-found')
          return
        }
        navigate(`/flows/${fkey}/${f.branches[0].key}`)
      }

      setIsReady(true)
    })

    return (
      <Show
        when={isReady()}
        fallback={<div class="flex items-center justify-center min-h-screen">加载中...</div>}
      >
        <WrappedComponent {...props} />
      </Show>
    )
  }
}
