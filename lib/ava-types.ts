export type AvaTaskUrgency = 'overdue' | 'two-hours' | 'one-day' | 'three-days' | 'later'

export interface AvaConnectionState {
  connected: boolean
  username?: string
  fullName?: string
  connectedAt?: number
  moodleUrl?: string
}

export interface AvaSemester {
  startsAt: string
  endsAt: string
}

export interface AvaCourse {
  id: number
  fullName: string
  shortName: string
  categoryId: number | null
  startsAt: string
  endsAt: string
  courseUrl: string
}

export interface AvaTask {
  id: string
  courseId: number
  courseName: string
  name: string
  description?: string
  moduleName: string
  moduleLabel: string
  deadline: string
  actionUrl?: string
  overdue: boolean
  urgency: AvaTaskUrgency
  urgencyLabel: string
}

export interface AvaOverview {
  courses: AvaCourse[]
  tasks: AvaTask[]
  semester: AvaSemester | null
  fetchedAt: string
}

export interface AvaCourseContentSummary {
  courseId: number
  sectionCount: number
  materialCount: number
}

export interface AvaContentSummary {
  courses: AvaCourseContentSummary[]
  fetchedAt: string
}

export interface AvaMaterial {
  id: string
  moduleId: number
  name: string
  description?: string
  type: string
  typeLabel: string
  fileName?: string
  mimeType?: string
  fileSize?: number
  updatedAt?: string
  downloadUrl?: string
  externalUrl?: string
}

export interface AvaSection {
  id: number
  name: string
  summary?: string
  materials: AvaMaterial[]
}

export interface AvaCourseDetail {
  course: AvaCourse
  tasks: AvaTask[]
  sections: AvaSection[]
  fetchedAt: string
}
