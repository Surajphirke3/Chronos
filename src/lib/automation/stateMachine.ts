import type { JobStatus } from '@/lib/automation/types'

const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ['processing', 'cancelled', 'scheduled'],
  scheduled: ['queued', 'processing', 'cancelled'],
  processing: ['completed', 'retrying', 'failed', 'dead_letter', 'cancelled'],
  retrying: ['queued', 'processing', 'cancelled', 'dead_letter'],
  completed: [],
  failed: ['queued', 'cancelled'], // manual retry → queued
  cancelled: [],
  dead_letter: ['queued', 'cancelled'], // manual retry → queued
}

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid job transition ${from} → ${to}`)
  }
}
