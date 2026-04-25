import { ApiResponse } from '@/types/api'
import { API_BASE_KEY } from '@/utils/constants'
import type { ExecutionQueueState } from '@/types/execution'

export const executeCommand = async (commands: string[], shell: string): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_BASE_KEY}/execution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commands, shell }),
    })
    return await response.json()
  } catch (error) {
    console.error('Error executing command:', error)
    return ApiResponse.error(error)
  }
}

export const getTasks = async (
  cursor?: number,
  limit?: number,
): Promise<ApiResponse<ExecutionQueueState>> => {
  const params = new URLSearchParams()
  if (cursor !== undefined) {
    params.append('taskId', cursor.toString())
  }
  if (limit !== undefined) {
    params.append('limit', limit.toString())
  }
  const url = `${API_BASE_KEY}/execution?${params.toString()}`

  try {
    const response = await fetch(url)
    return await response.json()
  } catch (error) {
    console.error('Error fetching execution queue:', error)
    return ApiResponse.error(error)
  }
}

export const executionStatusEventUrl = `${API_BASE_KEY}/execution/logs-event`
export const executionLogStreamUrl = `${API_BASE_KEY}/execution/logs-stream`

export const cancelTask = async (taskId: number): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_BASE_KEY}/execution?taskId=${taskId}`, {
      method: 'DELETE',
    })
    return await response.json()
  } catch (error) {
    console.error('Error cancelling task:', error)
    return ApiResponse.error(error)
  }
}

export const sendExecutionInput = async (input: string): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_BASE_KEY}/execution/input`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    })
    return await response.json()
  } catch (error) {
    console.error('Error sending execution input:', error)
    return ApiResponse.error(error)
  }
}

export const sendExecutionResize = async (cols: number, rows: number): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_BASE_KEY}/execution/resize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cols, rows }),
    })
    return await response.json()
  } catch (error) {
    console.error('Error syncing terminal size:', error)
    return ApiResponse.error(error)
  }
}
