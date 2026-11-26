import { useState } from 'react'
import { createTreeMaintenanceRequest, createWaterwayCleaningRequest } from '../services/api.js'
import ServicePageLayout, { FileUpload, ServiceSuccess } from '../layouts/ServicePageLayout.jsx'

const EMPTY_TREE_FORM = {
  fullName: '',
  contactNumber: '',
  location: '',
  landClassification: 'private',
  requestType: 'pruning',
  treeType: '',
  hazardDescription: '',
  denrDocument: null,
  denrDocumentReference: '',
  photo: null,
  instructionsAccepted: false,
}

const EMPTY_WATERWAY_FORM = {
  fullName: '',
  contactNumber: '',
  location: '',
  issueType: 'Canal or waterway cleaning',
  description: '',
  photo: null,
}

export default function ServicesPage() {
  const [serviceType, setServiceType] = useState('tree')

  return (
    <ServicePageLayout
      module=""
      title="Tree maintenance & waterway cleaning"
      description="Request help with a tree on your land or a public drainage and waterway concern. Each request receives its own trackable ticket."
    >
      <section className="service-guidance-card" aria-labelledby="module4-guidance-title">
        <span className="guidance-mark" aria-hidden="true">i</span>
        <div>
          <h2 id="module4-guidance-title">Before you submit a request</h2>
          <p>Tree cutting on private or own land may require DENR approval or a Certificate of No Objection. Check the applicable requirements before submitting; attach the document when you have it. Waterway requests are for public canals, drainage, and waterways.</p>
        </div>
      </section>

      <div className="service-type-tabs" aria-label="Module 4 request type">
        <button type="button" aria-pressed={serviceType === 'tree'} onClick={() => setServiceType('tree')}>
          <strong>Tree maintenance</strong><span>Cutting, pruning, or hazards</span>
        </button>
        <button type="button" aria-pressed={serviceType === 'waterway'} onClick={() => setServiceType('waterway')}>
          <strong>Waterway cleaning</strong><span>Canals, drainage, and clogs</span>
        </button>
      </div>

      {serviceType === 'tree' ? <TreeMaintenanceForm /> : <WaterwayCleaningForm />}
    </ServicePageLayout>
  )
}

function TreeMaintenanceForm() {
  const [form, setForm] = useState(EMPTY_TREE_FORM)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [request, setRequest] = useState(null)

  function updateField(event) {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      setRequest(await createTreeMaintenanceRequest(form))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Tree maintenance request could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setForm(EMPTY_TREE_FORM)
    setRequest(null)
    setError('')
  }

  return request ? (
    <ServiceSuccess
      request={request}
      title="Tree service ticket created"
      detail="Your tree location, request details, and photo evidence have been recorded."
      onReset={resetForm}
    />
  ) : (
    <form className="service-form-card service-form" onSubmit={handleSubmit} noValidate>
      <div className="service-form-heading">
        <div><p className="service-overline">LAND / TREE REQUEST</p><h2>Tree cutting, pruning, or hazard report</h2></div>
        <span className="required-note"><i>*</i> Required fields</span>
      </div>

      <label className="service-acknowledgement">
        <input type="checkbox" name="instructionsAccepted" checked={form.instructionsAccepted} onChange={updateField} required />
        <span>I have read the tree service instructions and will provide DENR approval or a Certificate of No Objection when required.</span>
      </label>

      <section className="service-form-section" aria-labelledby="tree-requester-title">
        <div className="service-section-heading">
          <span>01</span><div><h3 id="tree-requester-title">Your details</h3><p>We may contact you to confirm access or safety information.</p></div>
        </div>
        <div className="service-fields-grid">
          <label className="service-field">
            <span>Name <small>Optional</small></span>
            <input name="fullName" autoComplete="name" maxLength={60} placeholder="Leave blank if preferred" value={form.fullName} onChange={updateField} />
          </label>
          <label className="service-field">
            <span>Contact number <i>Required</i></span>
            <input name="contactNumber" type="tel" autoComplete="tel" maxLength={20} placeholder="+63 9XX XXX XXXX" value={form.contactNumber} onChange={updateField} required />
          </label>
        </div>
      </section>

      <section className="service-form-section" aria-labelledby="tree-location-title">
        <div className="service-section-heading">
          <span>02</span><div><h3 id="tree-location-title">Tree and land details</h3><p>Give the exact location and tell us what work is needed.</p></div>
        </div>
        <div className="service-fields-grid">
          <label className="service-field service-field--full">
            <span>Exact tree location or address <i>Required</i></span>
            <textarea name="location" rows={2} maxLength={160} placeholder="Street, landmark, barangay" value={form.location} onChange={updateField} required />
          </label>
          <label className="service-field">
            <span>Land classification <i>Required</i></span>
            <select name="landClassification" value={form.landClassification} onChange={updateField}>
              <option value="private">Private / own land</option>
              <option value="public">Public area</option>
            </select>
          </label>
          <label className="service-field">
            <span>Request type <i>Required</i></span>
            <select name="requestType" value={form.requestType} onChange={updateField}>
              <option value="pruning">Tree pruning</option>
              <option value="cutting">Tree cutting / removal</option>
            </select>
          </label>
          <label className="service-field">
            <span>Tree type <small>If known</small></span>
            <input name="treeType" maxLength={60} placeholder="Optional" value={form.treeType} onChange={updateField} />
          </label>
          <div className="service-field">
            <span>DENR approval / Certificate of No Objection <small>When applicable</small></span>
            <FileUpload
              id="tree-denr-document"
              label="Attach an approval document"
              accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
              value={form.denrDocument}
              help="PDF or image, up to 8 MB."
              onChange={(denrDocument) => {
                setForm((current) => ({ ...current, denrDocument }))
                setError('')
              }}
            />
            <label className="service-field">
              <span>Approval / certificate reference <small>Optional</small></span>
              <input name="denrDocumentReference" maxLength={120} placeholder="Reference number, if available" value={form.denrDocumentReference} onChange={updateField} />
            </label>
          </div>
          <label className="service-field service-field--full">
            <span>Hazard or pruning details <i>Required</i></span>
            <textarea name="hazardDescription" rows={3} maxLength={500} placeholder="For example: overhanging branches, close to power lines, risk of falling, or blocking a road." value={form.hazardDescription} onChange={updateField} required />
          </label>
        </div>
      </section>

      <section className="service-form-section" aria-labelledby="tree-photo-title">
        <div className="service-section-heading">
          <span>03</span><div><h3 id="tree-photo-title">Photo evidence</h3><p>Include a clear view of the tree and any immediate hazard.</p></div>
        </div>
        <FileUpload
          id="tree-photo"
          label="Photo of the tree"
          required
          value={form.photo}
          help="Add one JPG, PNG, or WebP image (up to 5 MB)."
          onChange={(photo) => {
            setForm((current) => ({ ...current, photo }))
            setError('')
          }}
        />
      </section>

      {error && <p className="service-form-error" role="alert">{error}</p>}
      <div className="service-submit-row">
        <p>After validation, you’ll receive a ticket reference and status.</p>
        <button className="service-submit-button" type="submit" disabled={submitting}>{submitting ? 'Submitting ticket…' : 'Submit tree request'}</button>
      </div>
    </form>
  )
}

function WaterwayCleaningForm() {
  const [form, setForm] = useState(EMPTY_WATERWAY_FORM)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [request, setRequest] = useState(null)

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      setRequest(await createWaterwayCleaningRequest(form))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Waterway request could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setForm(EMPTY_WATERWAY_FORM)
    setRequest(null)
    setError('')
  }

  return request ? (
    <ServiceSuccess
      request={request}
      title="Waterway cleaning ticket created"
      detail="Your public waterway location, issue details, and photo evidence have been recorded."
      onReset={resetForm}
    />
  ) : (
    <form className="service-form-card service-form" onSubmit={handleSubmit} noValidate>
      <div className="service-form-heading">
        <div><p className="service-overline">PUBLIC WATERWAY REQUEST</p><h2>Canal, drainage, or waterway cleaning</h2></div>
        <span className="required-note"><i>*</i> Required fields</span>
      </div>
      <p className="service-inline-note">This request is for public canals, drainage, and waterways. For immediate flooding or a safety emergency, contact your barangay directly.</p>

      <section className="service-form-section" aria-labelledby="waterway-requester-title">
        <div className="service-section-heading">
          <span>01</span><div><h3 id="waterway-requester-title">Your details</h3><p>Provide a contact so the team can follow up.</p></div>
        </div>
        <div className="service-fields-grid">
          <label className="service-field">
            <span>Name <small>Optional</small></span>
            <input name="fullName" autoComplete="name" maxLength={60} placeholder="Leave blank if preferred" value={form.fullName} onChange={updateField} />
          </label>
          <label className="service-field">
            <span>Contact number <i>Required</i></span>
            <input name="contactNumber" type="tel" autoComplete="tel" maxLength={20} placeholder="+63 9XX XXX XXXX" value={form.contactNumber} onChange={updateField} required />
          </label>
        </div>
      </section>

      <section className="service-form-section" aria-labelledby="waterway-issue-title">
        <div className="service-section-heading">
          <span>02</span><div><h3 id="waterway-issue-title">Location and issue</h3><p>Pinpoint the public place where cleaning is needed.</p></div>
        </div>
        <div className="service-fields-grid">
          <label className="service-field">
            <span>Waterway service <i>Required</i></span>
            <select name="issueType" value={form.issueType} onChange={updateField}>
              <option>Canal or waterway cleaning</option>
              <option>Drainage cleaning</option>
              <option>Water waste or clogging</option>
            </select>
          </label>
          <label className="service-field service-field--full">
            <span>Exact public location <i>Required</i></span>
            <textarea name="location" rows={2} maxLength={160} placeholder="Canal, drainage, street, landmark, barangay" value={form.location} onChange={updateField} required />
          </label>
          <label className="service-field service-field--full">
            <span>Description of water waste or clogging <i>Required</i></span>
            <textarea name="description" rows={3} maxLength={500} placeholder="Describe the blockage, buildup, or cleaning concern." value={form.description} onChange={updateField} required />
          </label>
        </div>
      </section>

      <section className="service-form-section" aria-labelledby="waterway-photo-title">
        <div className="service-section-heading">
          <span>03</span><div><h3 id="waterway-photo-title">Photo evidence</h3><p>Show the canal or drainage issue clearly.</p></div>
        </div>
        <FileUpload
          id="waterway-photo"
          label="Photo of the canal or waterway"
          required
          value={form.photo}
          help="Add one JPG, PNG, or WebP image (up to 5 MB)."
          onChange={(photo) => {
            setForm((current) => ({ ...current, photo }))
            setError('')
          }}
        />
      </section>

      {error && <p className="service-form-error" role="alert">{error}</p>}
      <div className="service-submit-row">
        <p>A trackable water-cleaning ticket is generated after submission.</p>
        <button className="service-submit-button" type="submit" disabled={submitting}>{submitting ? 'Submitting ticket…' : 'Submit waterway request'}</button>
      </div>
    </form>
  )
}
