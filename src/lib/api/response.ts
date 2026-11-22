import { NextResponse } from 'next/server'

export function apiOk<T>(data: T, init?: { status?: number }) {
  return NextResponse.json(data, { status: init?.status ?? 200 })
}

export function apiError(
  error: string,
  status = 400,
  extras?: Record<string, unknown>
) {
  return NextResponse.json({ error, ...extras }, { status })
}

export function apiUnauthorized(message = 'Unauthorized') {
  return apiError(message, 401)
}

export function apiForbidden(message = 'Forbidden') {
  return apiError(message, 403)
}

export function apiNotFound(message = 'Not found') {
  return apiError(message, 404)
}

export function apiTooMany(message = 'Too many requests', retryAfterSec?: number) {
  const headers = retryAfterSec
    ? { 'Retry-After': String(retryAfterSec) }
    : undefined
  return NextResponse.json({ error: message }, { status: 429, headers })
}
