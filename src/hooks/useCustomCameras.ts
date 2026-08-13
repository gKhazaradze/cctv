import { useCallback, useEffect, useState } from 'react'
import {
  loadCustomCameras,
  saveCustomCameras,
  type CustomCameraInput,
} from '../lib/customCameras'

/**
 * The user's own added cameras, persisted in localStorage and kept in sync
 * across tabs.
 */
export function useCustomCameras() {
  const [cameras, setCameras] = useState<CustomCameraInput[]>(() => loadCustomCameras())

  useEffect(() => {
    saveCustomCameras(cameras)
  }, [cameras])

  // Another tab adding or removing a camera should show up here too.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'citywatch:customCameras:v1') setCameras(loadCustomCameras())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const upsert = useCallback((camera: CustomCameraInput) => {
    setCameras((prev) => {
      const idx = prev.findIndex((c) => c.id === camera.id)
      if (idx === -1) return [...prev, camera]
      const next = prev.slice()
      next[idx] = camera
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setCameras((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return { cameras, upsert, remove }
}
