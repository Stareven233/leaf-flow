import { useParams } from '@solidjs/router'

type DecodedParams<T extends Record<string, string>> = {
  readonly [K in keyof T]: string
}

export function useDecodedParams<
  T extends Record<string, string> = Record<string, string>,
>(): DecodedParams<T> {
  const params = useParams<T>()
  return new Proxy(params, {
    get(target, key: string) {
      const val = target[key]
      return val !== undefined ? decodeURIComponent(val) : val
    },
  }) as DecodedParams<T>
}
