import { ecoflowIntercept } from './ecoflow.ts'

export interface InterceptRequest {
  host: string
  method: string
  path: string
  modifyBody(body: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer>
}

export const INTERCEPT_REQUESTS: InterceptRequest[] = [
  ecoflowIntercept,
]
