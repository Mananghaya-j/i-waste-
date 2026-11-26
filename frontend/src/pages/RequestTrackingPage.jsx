import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SiteNavbar from '../components/SiteNavbar.jsx'
import { publicRequest } from '../services/authApi.js'
import '../styles/requestTracking.css'

function displayStatus(status) {
  return status.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())
}

export default function RequestTrackingPage() {
  const [searchParams] = useSearchParams()
  const [referenceNo, setReferenceNo] = useState(searchParams.get('reference') || '')
  const [request, setRequest] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setRequest(null)
    setLoading(true)
    try {
      const response = await publicRequest(`/requests/track/${encodeURIComponent(referenceNo.trim())}`)
      setRequest(response.data)
    } catch (trackingError) {
      setError(trackingError.message || 'Unable to find that request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SiteNavbar />
      <main className="request-tracking-page">
        <section className="request-tracking-card">
          <p className="request-tracking-eyebrow">PUBLIC SERVICE</p>
          <h1>Track a service request</h1>
          <p>Enter the reference number provided when the request was submitted.</p>
          <form onSubmit={submit}>
            <label htmlFor="request-reference">Reference number</label>
            <input id="request-reference" value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} required minLength={8} maxLength={32} autoComplete="off" />
            {error && <p className="request-tracking-error" role="alert">{error}</p>}
            <button type="submit" disabled={loading}>{loading ? 'Checking…' : 'Track request'}</button>
          </form>
          {request && (
            <section className="request-tracking-result" aria-live="polite">
              <div className="request-tracking-summary">
                <div><small>REFERENCE</small><strong>{request.referenceNo}</strong></div>
                <div><small>CURRENT STATUS</small><strong>{displayStatus(request.status)}</strong></div>
              </div>
              <h2>Status history</h2>
              <ol className="request-timeline">
                {request.statusHistory.map((item, index) => (
                  <li key={`${item.createdAt}-${index}`}>
                    <i aria-hidden="true" />
                    <div><strong>{displayStatus(item.toStatus)}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div>
                  </li>
                ))}
              </ol>
              <p className="request-tracking-private">Personal details and internal notes are not shown on public tracking.</p>
            </section>
          )}
        </section>
      </main>
    </>
  )
}
