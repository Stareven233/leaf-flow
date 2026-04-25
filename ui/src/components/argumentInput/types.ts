import type { Argument } from '@/types/project'

export interface ArgumentInputProps {
  argument: Argument
  setArgument: (updates: Partial<Argument>) => void
}
