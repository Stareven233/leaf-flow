export class ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string

  constructor(success: boolean, data?: T, message?: string) {
    this.success = success
    this.data = data
    this.message = message
  }

  static async fromJSONResponse<T = any>(resp: Response): Promise<ApiResponse<T>> {
    const r = await resp.json()
    return new ApiResponse(r.success, r.data, r.message)
  }

  static success<T = any>(data?: T, message?: string): ApiResponse<T> {
    return new ApiResponse(true, data, message)
  }

  static error<T = any>(message?: string | Error | unknown, data?: T): ApiResponse<T> {
    let msg: string
    if (message instanceof Error) {
      msg = message.message
    } else {
      msg = String(message)
    }
    return new ApiResponse(false, data, msg)
  }
}
