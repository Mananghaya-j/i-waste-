import { useEffect, useRef } from 'react'

export default function ModalDialog({ children, onClose, titleId, className = '' }) {
  const dialogRef = useRef(null)
  const closeHandler = useRef(onClose)

  useEffect(() => {
    closeHandler.current = onClose
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined

    const closeOnCancel = (event) => {
      event.preventDefault()
      closeHandler.current()
    }
    const closeOnBackdrop = (event) => {
      if (event.target === dialog) closeHandler.current()
    }

    dialog.addEventListener('cancel', closeOnCancel)
    dialog.addEventListener('click', closeOnBackdrop)
    if (!dialog.open) dialog.showModal()
    return () => {
      dialog.removeEventListener('cancel', closeOnCancel)
      dialog.removeEventListener('click', closeOnBackdrop)
      if (dialog.open) dialog.close()
    }
  }, [])

  return (
    <dialog ref={dialogRef} className={`app-modal ${className}`} aria-labelledby={titleId}>
      <button type="button" className="app-modal-close" onClick={onClose} aria-label="Close dialog">×</button>
      <div className="app-modal-content">{children}</div>
    </dialog>
  )
}
