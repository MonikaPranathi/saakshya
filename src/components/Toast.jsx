import { useState, useCallback } from 'react'

/**
 * useToast — returns { toasts, showToast }
 * showToast(message, duration=2500)
 */
export function useToast() {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, duration = 2500) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  return { toasts, showToast }
}

export function ToastContainer({ toasts }) {
  if (!toasts.length) return null
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className="toast">{t.message}</div>
      ))}
    </div>
  )
}
