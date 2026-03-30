export type OrgMemberRole = 'athlete' | 'coach'
export type MemberStatus = 'active' | 'pending' | 'suspended'
export type PostType = 'announcement' | 'event' | 'news' | 'result'
export type PostVisibility = 'all' | 'members' | 'coaches'
export type NewsletterStatus = 'draft' | 'sent' | 'scheduled'
export type SportType =
  | 'athletics'
  | 'swimming'
  | 'cycling'
  | 'triathlon'
  | 'football'
  | 'basketball'
  | 'tennis'
  | 'volleyball'
  | 'wrestling'
  | 'other'

export interface Organization {
  id: string
  user_id: string
  org_name: string
  org_slug: string
  sport_type: SportType | null
  city: string | null
  is_verified: boolean
  created_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: OrgMemberRole
  status: MemberStatus
  joined_at: string
  user?: {
    name: string
    email: string
  }
}

export interface WallPost {
  id: string
  org_id: string
  author_id: string
  title: string
  body: string
  post_type: PostType
  event_date: string | null
  visible_to: PostVisibility
  is_pinned: boolean
  is_deleted: boolean
  created_at: string
}

export interface Newsletter {
  id: string
  org_id: string
  author_id: string
  subject: string
  body: string
  target_roles: OrgMemberRole[]
  status: NewsletterStatus
  scheduled_at: string | null
  sent_at: string | null
  created_at: string
}

export interface NewsletterDelivery {
  id: string
  newsletter_id: string
  recipient_id: string
  delivered_at: string | null
  opened_at: string | null
  status: 'pending' | 'delivered' | 'failed'
}

export interface NewsletterStats {
  sent: number
  delivered: number
  opened: number
  failed: number
}
