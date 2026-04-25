import HomeView from '@/views/Home'
import TaskQueueView from '@/views/TaskQueue'
import ProjectLayout from '@/views/project/ProjectLayout'
import ProjectView from '@/views/project/Project'
import FlowLayout from '@/views/flow/FlowLayout'
import FlowView from '@/views/flow/Flow'
import NotFoundView from '@/views/NotFound'
import { withProjectGuard, withFlowGuard } from '@/utils/routes/guard'
import { useNavigate } from '@solidjs/router'
import type { NavigateOptions } from '@solidjs/router'
import { EntryType } from '@/types/project'

export const useAppNavigate = () => {
  const doNavigate = useNavigate()
  return (
    type: EntryType,
    key: string,
    subKey?: string,
    options?: Partial<NavigateOptions<unknown>>,
  ) => {
    const base = type === 'flow' ? 'flows' : 'projects'
    const segments = subKey ? [base, key, subKey] : [base, key]
    doNavigate(`/${segments.join('/')}`, options)
  }
}

export const routes = [
  {
    path: '/',
    component: HomeView,
  },
  {
    path: '/tasks',
    component: TaskQueueView,
  },
  {
    path: '/flows/:flow',
    component: withFlowGuard(FlowLayout),
    children: [
      {
        path: '/',
        component: () => null,
      },
      {
        path: '/:branch',
        component: FlowView,
      },
    ],
  },
  {
    path: '/projects/:project',
    component: withProjectGuard(ProjectLayout),
    children: [
      {
        path: '/',
        component: () => null,
      },
      {
        path: '/:module',
        component: ProjectView,
      },
    ],
  },
  {
    path: '*',
    component: NotFoundView,
  },
]
