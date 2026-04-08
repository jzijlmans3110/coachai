export interface Coach {
  id: string
  full_name: string
  stripe_customer_id: string | null
  plan: 'free' | 'pro'
  created_at: string
}

export interface Client {
  id: string
  coach_id: string
  full_name: string
  goal: string
  level: 'beginner' | 'intermediate' | 'advanced'
  days_per_week: number
  injuries: string | null
  equipment: string[]
  age: number | null
  weight_kg: number | null
  height_cm: number | null
  gender: 'man' | 'vrouw' | 'anders' | null
  experience_years: number | null
  training_time: 'ochtend' | 'middag' | 'avond' | 'wisselend' | null
  medical_notes: string | null
  phone: string | null
  created_at: string
}

export interface Exercise {
  name: string
  sets: number
  reps: string
  rest: string
  notes: string
}

export interface ProgramDay {
  day: string
  focus: string
  exercises: Exercise[]
}

export interface ProgramWeek {
  week: number
  days: ProgramDay[]
}

export interface ProgramContent {
  title: string
  weeks: ProgramWeek[]
}

export interface Program {
  id: string
  client_id: string
  coach_id: string
  title: string
  weeks: number
  content: ProgramContent
  ai_generated: boolean
  created_at: string
}

export interface CheckIn {
  id: string
  client_id: string
  week_number: number
  weight_kg: number | null
  energy: number
  sleep_hrs: number | null
  notes: string | null
  ai_feedback: string | null
  submitted_at: string
}
