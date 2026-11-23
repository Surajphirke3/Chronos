export class AppError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'AppError'
    this.status = status
  }
}

export function toSafeClientMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof AppError) return error.message
  return fallback
}
