// W21 audit fix: was 'athlete' | 'coach' but the DB CHECK (migration 053)
// allows 6 values — org.service.ts cast owners/admins/doctors to a too-narrow
// type. Widened to match the constraint.
export type OrgMemberRole =
  | 'org_owner'
  | 'org_admin'
  | 'coach'
  | 'doctor'
  | 'specialist'
  | 'athlete'
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
  // NOTE: organizations table has no user_id / owner_id column. The
  // owner relationship is via org_members (status='active' + the role
  // that signifies admin/owner). See services/org.service.ts:getMyOrg.
  id: string
  org_name: string
  org_slug: string
  sport_type: SportType | null
  city: string | null
  is_verified: boolean
  created_at: string
}

export interface OrgMember {
  // DB column is `member_role`, NOT `role` — the previous interface was
  // a fiction the regenerated types caught.
  id: string
  org_id: string
  user_id: string
  member_role: OrgMemberRole
  status: MemberStatus
  joined_at: string | null
  user?: {
    name: string
    email: string
  }
}

export interface WallPost {
  // visible_to is text[] in the DB (default ['athlete','coach','public']);
  // the service translates the API-level PostVisibility union to/from
  // that array. Soft delete is via deleted_at IS NULL — the previous
  // is_deleted boolean was never on the table.
  id: string
  org_id: string
  author_id: string
  title: string
  body: string
  post_type: PostType
  event_date: string | null
  visible_to: PostVisibility
  is_pinned: boolean
  deleted_at: string | null
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
