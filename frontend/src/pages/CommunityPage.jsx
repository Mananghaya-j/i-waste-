import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import SiteNavbar from '../components/SiteNavbar.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { getCommunityContent, joinCommunityEvent } from '../services/api.js'
import '../styles/community.css'

const announcements = new Set(['GREETING', 'ANNOUNCEMENT'])
const resources = new Set(['MEMO', 'CITY_ORDINANCE', 'BARANGAY_ORDINANCE', 'RA_9003'])

function CommunityItem({ item, children }) {
  return (
    <article className="community-item">
      <div className="community-item-heading">
        <div><h3>{item.title}</h3>{item.startsAt && <time dateTime={item.startsAt}>{new Date(item.startsAt).toLocaleString()}</time>}</div>
        {item.location && <span>{item.location}</span>}
      </div>
      <p>{item.body}</p>
      {children}
    </article>
  )
}

function CommunityPage() {
  const { user, status } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [content, setContent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState('')

  useEffect(() => {
    let active = true
    getCommunityContent()
      .then((items) => {
        if (active) setContent(items)
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Community updates are unavailable.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const events = useMemo(() => content.filter((item) => ['COMMUNITY_EVENT', 'ACTIVITY_SCHEDULE'].includes(item.category)), [content])
  const news = useMemo(() => content.filter((item) => announcements.has(item.category)), [content])
  const documents = useMemo(() => content.filter((item) => resources.has(item.category)), [content])

  async function joinEvent(eventId) {
    if (status !== 'authenticated' || user?.role !== 'RESIDENT') {
      navigate('/login', { state: { from: location } })
      return
    }
    setJoining(eventId)
    setError('')
    try {
      await joinCommunityEvent({ eventId })
      setContent((current) => current.map((item) => item.id === eventId
        ? { ...item, joined: true, rsvpCount: item.rsvpCount + 1 }
        : item))
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Unable to join this event.')
    } finally {
      setJoining('')
    }
  }

  return (
    <div className="service-app community-app">
      <SiteNavbar />
      <main className="service-main community-main">
        <section className="service-intro">
          <p className="service-overline">BAGONG SILANGAN · COMMUNITY</p>
          <h1>Community events and updates</h1>
          <p>Find activity schedules, greetings and announcements, and official community references.</p>
        </section>
        {error && <p className="community-message community-message--error" role="alert">{error}</p>}
        {loading ? <p className="community-message" role="status">Loading community updates…</p> : (
          <div className="community-sections">
            <section aria-labelledby="community-events-title">
              <header><p>TAKE PART</p><h2 id="community-events-title">Schedules of activities</h2></header>
              <div className="community-list">
                {events.map((item) => (
                  <CommunityItem item={item} key={item.id}>
                    <div className="community-event-actions">
                      <span>{item.rsvpCount} resident{item.rsvpCount === 1 ? '' : 's'} joined</span>
                      <button type="button" className="service-submit-button" disabled={joining === item.id || item.joined} onClick={() => joinEvent(item.id)}>
                        {joining === item.id ? 'Joining…' : item.joined ? 'Joined ✓' : 'Join event'}
                      </button>
                    </div>
                  </CommunityItem>
                ))}
                {!events.length && <p className="community-empty">No published activities are scheduled right now.</p>}
              </div>
            </section>

            <section aria-labelledby="community-announcements-title">
              <header><p>STAY INFORMED</p><h2 id="community-announcements-title">Greetings and announcements</h2></header>
              <div className="community-list">
                {news.map((item) => <CommunityItem item={item} key={item.id} />)}
                {!news.length && <p className="community-empty">No published greetings or announcements yet.</p>}
              </div>
            </section>

            <section aria-labelledby="community-resources-title">
              <header><p>PUBLIC INFORMATION</p><h2 id="community-resources-title">Memos and ordinances</h2></header>
              <div className="community-list">
                {documents.map((item) => <CommunityItem item={item} key={item.id} />)}
                {!documents.length && <p className="community-empty">No published memos or ordinance references yet.</p>}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default CommunityPage
