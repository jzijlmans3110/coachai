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

export interface BodyMeasurement {
  id: string
  client_id: string
  measured_at: string
  weight_kg: number | null
  chest_cm: number | null
  waist_cm: number | null
  hips_cm: number | null
  bicep_cm: number | null
  thigh_cm: number | null
  notes: string | null
  created_at: string
}

export interface SessionNote {
  id: string
  client_id: string
  coach_id: string
  content: string
  session_date: string
  created_at: string
}

export interface Milestone {
  id: string
  client_id: string
  title: string
  target_date: string | null
  achieved_at: string | null
  created_at: string
}

export interface MealItem {
  name: string
  time?: string
  foods: string[]
  calories: number
  protein: number
}

export interface MealDay {
  day: string
  total_calories: number
  total_protein: number
  meals: MealItem[]
}

export interface MealPlanContent {
  title: string
  calories_target: number
  protein_target: number
  carbs_target?: number
  fat_target?: number
  days: MealDay[]
}

export interface MealPlan {
  id: string
  client_id: string
  coach_id: string
  title: string
  content: MealPlanContent
  ai_generated: boolean
  created_at: string
}
